import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  buildCapitalAssetName,
  fetchTinvestAccounts,
  fetchTinvestInstrumentByFigi,
  fetchTinvestOperations,
  fetchTinvestPortfolio,
  getFxDisplayName,
  mapInstrumentAssetType,
  mapOperationToTransaction,
  moneyToNumber,
  quantityToNumber,
  resolveAveragePurchaseRateRub,
  resolvePositionValueRub,
  resolveTinvestCurrencyUnit,
} from '../_shared/tinvest.ts'
import { syncCapitalPeriodMetricsForUser } from '../_shared/capitalMetricsSync.ts'

type SyncBody = {
  connectionId?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const body = (await req.json()) as SyncBody
    const connectionId = body.connectionId
    if (!connectionId) return jsonResponse({ error: 'connectionId required' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: connection, error: connError } = await admin
      .from('financial_connections')
      .select('id,user_id,provider_id,status,sync_cursor')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) return jsonResponse({ error: 'Connection not found' }, 404)
    if (connection.user_id !== user.id) return jsonResponse({ error: 'Forbidden' }, 403)
    if (connection.provider_id !== 'tinkoff_invest') {
      return jsonResponse({ error: 'Not a T-Invest connection' }, 400)
    }
    if (connection.status === 'revoked') {
      return jsonResponse({ ok: false, message: 'Подключение отключено' }, 400)
    }

    const { data: secretRow, error: secretError } = await admin
      .from('financial_connection_secrets')
      .select('token_payload')
      .eq('connection_id', connectionId)
      .single()

    if (secretError || !secretRow) {
      return jsonResponse({ ok: false, message: 'Токен не найден. Подключите T-Invest заново.' }, 400)
    }

    const token = String((secretRow.token_payload as { access_token?: string })?.access_token ?? '')
    if (!token) {
      return jsonResponse({ ok: false, message: 'Токен пустой' }, 400)
    }

    const accounts = await fetchTinvestAccounts(token)
    let positionsImported = 0
    let transactionsImported = 0
    const syncErrors: string[] = []
    const fromIso = new Date(Date.now() - 90 * 86_400_000).toISOString()

    type AggregatedPosition = {
      ticker: string
      figi: string
      assetType: string
      quantity: number
      valueRub: number
      rateRub: number
      avgPurchaseRateRub: number | null
      unit: string
      displayName: string
    }

    const aggregatedPositions = new Map<string, AggregatedPosition>()
    const instrumentNameCache = new Map<string, string>()

    for (const account of accounts) {
      const accountId = account.id
      if (!accountId) continue

      const accountName = account.name || `T-Invest · ${account.type ?? 'счёт'}`
      const { data: upsertedAccounts, error: finAccError } = await admin
        .from('financial_accounts')
        .upsert(
          {
            user_id: user.id,
            connection_id: connectionId,
            external_account_id: accountId,
            name: accountName,
            account_kind: 'brokerage',
            currency: 'RUB',
            is_active: true,
          },
          { onConflict: 'connection_id,external_account_id' }
        )
        .select('id')

      if (finAccError) throw finAccError
      const financialAccountId = upsertedAccounts?.[0]?.id as string | undefined

      const portfolio = await fetchTinvestPortfolio(token, accountId)
      const totalRub = moneyToNumber(portfolio.totalAmount)

      if (financialAccountId && totalRub > 0) {
        await admin
          .from('financial_accounts')
          .update({
            balance: totalRub,
            balance_updated_at: new Date().toISOString(),
          })
          .eq('id', financialAccountId)
      }

      for (const pos of portfolio.positions ?? []) {
        const figi = pos.figi ?? pos.instrumentUid
        const ticker = (pos.ticker ?? figi ?? 'asset').toUpperCase()
        if (!figi) continue

        const qty = quantityToNumber(pos.quantity)
        if (qty <= 0) continue

        const { rateRub, valueRub } = resolvePositionValueRub(pos)
        if (valueRub <= 0) {
          syncErrors.push(`${ticker}: нет цены в ответе API`)
          continue
        }

        const assetType = mapInstrumentAssetType(pos.instrumentType)
        const moneyCurrency =
          pos.currentPrice?.currency ?? pos.averagePositionPrice?.currency ?? undefined
        const unit =
          assetType === 'cash'
            ? resolveTinvestCurrencyUnit(ticker, moneyCurrency)
            : ticker.toLowerCase()

        let displayName = ticker
        if (assetType === 'cash') {
          displayName = getFxDisplayName(unit)
        } else {
          const cachedName = instrumentNameCache.get(figi)
          if (cachedName) {
            displayName = cachedName
          } else {
            const instrument = await fetchTinvestInstrumentByFigi(token, figi)
            const resolvedName = instrument?.name?.trim()
            if (resolvedName) {
              displayName = resolvedName
              instrumentNameCache.set(figi, resolvedName)
            }
          }
        }

        const purchaseRate =
          assetType === 'cash' ? null : resolveAveragePurchaseRateRub(pos)

        const aggregateKey = `${assetType}:${unit}`
        const existing = aggregatedPositions.get(aggregateKey)

        if (existing) {
          const prevQty = existing.quantity
          existing.quantity += qty
          existing.valueRub += valueRub
          existing.rateRub =
            existing.quantity > 0 ? existing.valueRub / existing.quantity : rateRub
          if (purchaseRate != null && purchaseRate > 0) {
            const prevAvg = existing.avgPurchaseRateRub ?? purchaseRate
            existing.avgPurchaseRateRub =
              existing.quantity > 0
                ? (prevAvg * prevQty + purchaseRate * qty) / existing.quantity
                : purchaseRate
          }
        } else {
          aggregatedPositions.set(aggregateKey, {
            ticker,
            figi,
            assetType,
            quantity: qty,
            valueRub,
            rateRub,
            avgPurchaseRateRub: purchaseRate,
            unit,
            displayName,
          })
        }
      }
    }

    const syncedExternalIds: string[] = []
    const fetchedAt = new Date().toISOString()

    for (const agg of aggregatedPositions.values()) {
      const externalPositionId = `ticker:${agg.ticker.toLowerCase()}`
      syncedExternalIds.push(externalPositionId)

      const symbol =
        agg.assetType === 'cash' ? agg.unit.toUpperCase() : agg.ticker.toUpperCase()
      const assetName = buildCapitalAssetName(symbol, agg.displayName)

      const assetPayload = {
        user_id: user.id,
        name: assetName,
        amount: agg.valueRub,
        asset_type: agg.assetType,
        valuation_mode: 'market',
        quantity: agg.quantity,
        unit: agg.unit,
        market_rate_rub: agg.rateRub,
        market_value_rub: agg.valueRub,
        avg_purchase_rate_rub:
          agg.avgPurchaseRateRub != null && agg.avgPurchaseRateRub > 0
            ? agg.avgPurchaseRateRub
            : null,
        market_fetched_at: fetchedAt,
        is_active: true,
        note: 'Синхронизация T-Invest',
        financial_connection_id: connectionId,
        external_position_id: externalPositionId,
      }

      const { data: existingAsset } = await admin
        .from('capital_assets')
        .select('id')
        .eq('user_id', user.id)
        .eq('financial_connection_id', connectionId)
        .eq('external_position_id', externalPositionId)
        .maybeSingle()

      const { error: assetError } = existingAsset?.id
        ? await admin.from('capital_assets').update(assetPayload).eq('id', existingAsset.id)
        : await admin.from('capital_assets').insert(assetPayload)

      if (assetError) {
        console.error('capital_assets sync error', agg.ticker, assetError)
        syncErrors.push(`${agg.ticker}: ${assetError.message}`)
      } else {
        positionsImported += 1
      }
    }

    const { data: staleBrokerAssets } = await admin
      .from('capital_assets')
      .select('id, external_position_id')
      .eq('financial_connection_id', connectionId)

    for (const row of staleBrokerAssets ?? []) {
      const externalId = row.external_position_id ? String(row.external_position_id) : ''
      if (!externalId || !syncedExternalIds.includes(externalId)) {
        await admin.from('capital_assets').delete().eq('id', row.id)
      }
    }

    for (const account of accounts) {
      const accountId = account.id
      if (!accountId) continue

      const { data: finAccount } = await admin
        .from('financial_accounts')
        .select('id')
        .eq('connection_id', connectionId)
        .eq('external_account_id', accountId)
        .maybeSingle()

      const financialAccountId = finAccount?.id as string | undefined

      let cursor: string | undefined
      let hasNext = true
      while (hasNext) {
        const page = await fetchTinvestOperations(token, accountId, fromIso, cursor)
        for (const op of page.items ?? []) {
          const mapped = mapOperationToTransaction(op)
          if (!mapped) continue

          const { error: txError } = await admin.from('transactions').insert({
            user_id: user.id,
            title: mapped.title,
            amount: mapped.amount,
            category: mapped.category,
            date: mapped.date,
            kind: mapped.kind,
            source: 'broker',
            external_id: `${accountId}:${mapped.externalId}`,
            financial_connection_id: connectionId,
            financial_account_id: financialAccountId ?? null,
            note: 'T-Invest',
          })
          if (!txError) transactionsImported += 1
        }
        cursor = page.nextCursor
        hasNext = Boolean(page.hasNext && cursor)
        if (!page.items?.length) break
      }
    }

    const message =
      positionsImported > 0 || transactionsImported > 0
        ? `Портфель: ${positionsImported} поз., операций: ${transactionsImported}`
        : syncErrors.length > 0
          ? `Ничего не импортировано. ${syncErrors.slice(0, 2).join('; ')}`
          : 'Портфель пуст в ответе T-Invest (0 позиций на счетах)'

    await admin
      .from('financial_connections')
      .update({
        status: 'active',
        last_sync_at: new Date().toISOString(),
        last_sync_error: syncErrors.length > 0 ? syncErrors.slice(0, 3).join('; ') : null,
        sync_cursor: { lastSync: new Date().toISOString(), from: fromIso },
      })
      .eq('id', connectionId)

    try {
      await syncCapitalPeriodMetricsForUser(admin, user.id, { force: true })
    } catch (metricsError) {
      console.error('capital metrics after tinvest-sync', metricsError)
    }

    return jsonResponse({
      ok: true,
      positionsImported,
      transactionsImported,
      message,
      errors: syncErrors.length > 0 ? syncErrors.slice(0, 5) : undefined,
    })
  } catch (error) {
    console.error('tinvest-sync error', error)
    const message = error instanceof Error ? error.message : 'Sync failed'
    return jsonResponse({ ok: false, message }, 500)
  }
})
