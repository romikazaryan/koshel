import { SignJWT, importPKCS8 } from 'npm:jose@5.9.6'

const YC_IAM_TOKEN_URL = 'https://iam.api.cloud.yandex.net/iam/v1/tokens'
const YC_LLM_COMPLETION_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion'
const YC_VISION_BATCH_ANALYZE_URL = 'https://vision.api.cloud.yandex.net/vision/v1/batchAnalyze'

export function getEnv(name: string): string {
  const val = Deno.env.get(name)
  if (!val) throw new Error(`Missing env: ${name}`)
  return val
}

function normalizePem(pem: string) {
  // Sometimes private keys are injected with escaped newlines.
  return pem.replace(/\\n/g, '\n')
}

let cachedIamToken: { token: string; expiresAtMs: number } | null = null

export async function getIamToken(): Promise<string> {
  // Fast path: optionally provide already-created IAM token.
  const existing = Deno.env.get('YANDEX_IAM_TOKEN')
  if (existing) return existing

  const nowMs = Date.now()
  if (cachedIamToken && cachedIamToken.expiresAtMs > nowMs + 60_000) {
    return cachedIamToken.token
  }

  const serviceAccountId = getEnv('YANDEX_IAM_SERVICE_ACCOUNT_ID')
  const keyId = getEnv('YANDEX_IAM_SERVICE_ACCOUNT_KEY_ID')
  const privateKeyPem = normalizePem(getEnv('YANDEX_IAM_SERVICE_ACCOUNT_PRIVATE_KEY'))

  // Yandex IAM token creation via JWT (PS256).
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: serviceAccountId,
    aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
    iat: now,
    exp: now + 3600,
  }

  const privateKey = await importPKCS8(privateKeyPem, 'PS256')

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'PS256', typ: 'JWT', kid: keyId })
    .sign(privateKey)

  const resp = await fetch(YC_IAM_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwt }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Failed to get IAM token: ${resp.status} ${text}`)
  }

  const data = await resp.json()
  const iamToken: string | undefined = data?.iamToken
  if (!iamToken) throw new Error('IAM token response missing iamToken')

  // IAM tokens live ~12h; refresh a bit early to avoid mid-request expiry.
  cachedIamToken = { token: iamToken, expiresAtMs: nowMs + 11 * 60 * 60 * 1000 }
  return iamToken
}

function safeExtractCompletionText(apiResponse: any): string {
  const text = apiResponse?.result?.alternatives?.[0]?.message?.text
  if (typeof text !== 'string') throw new Error('Completion response missing result.alternatives[0].message.text')
  return text
}

export async function yandexGptCompletionText(params: {
  modelUri: string
  prompt: string
  temperature?: number
  maxTokens?: number
}): Promise<string> {
  const iamToken = await getIamToken()
  const completionOptions = {
    stream: false,
    temperature: params.temperature ?? 0.2,
    maxTokens: params.maxTokens ?? 800,
  }

  const body = {
    modelUri: params.modelUri,
    completionOptions,
    messages: [{ role: 'user', text: params.prompt }],
  }

  const resp = await fetch(YC_LLM_COMPLETION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${iamToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`YandexGPT completion failed: ${resp.status} ${text}`)
  }

  const apiResponse = await resp.json()
  return safeExtractCompletionText(apiResponse)
}

function flattenAllTextValues(obj: any, limit = 200_000): string {
  const out: string[] = []
  let total = 0

  const visit = (value: any) => {
    if (total >= limit) return
    if (typeof value === 'string') {
      // Many OCR responses contain lots of small fragments; we still keep them,
      // but avoid adding extremely large strings.
      if (value.length > 5000) return
      out.push(value)
      total += value.length
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (value && typeof value === 'object') {
      for (const v of Object.values(value)) visit(v)
    }
  }

  visit(obj)
  return out.join('\n')
}

export async function visionBatchAnalyzeText(imageBase64: string): Promise<string> {
  const iamToken = await getIamToken().catch(() => undefined)
  const visionApiKey = Deno.env.get('YANDEX_VISION_API_KEY')

  const analyzeBody = {
    analyze_specs: [
      {
        content: imageBase64,
        features: [
          {
            type: 'TEXT_DETECTION',
            text_detection_config: {
              language_codes: ['ru', 'en'],
            },
          },
        ],
      },
    ],
  }

  const tryRequest = async (headers: Record<string, string>) => {
    const resp = await fetch(YC_VISION_BATCH_ANALYZE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(analyzeBody),
    })
    const rawText = await resp.text()
    let parsed: any = null
    try {
      parsed = JSON.parse(rawText)
    } catch {
      // keep parsed as null
    }
    if (!resp.ok) {
      throw new Error(`Vision batchAnalyze failed: ${resp.status} ${rawText}`)
    }
    return parsed ?? rawText
  }

  // Prefer IAM (Bearer) if available; retry with Api-Key if we have it.
  try {
    if (iamToken) {
      const data = await tryRequest({
        Authorization: `Bearer ${iamToken}`,
        'Content-Type': 'application/json',
      })
      return flattenAllTextValues(data)
    }
  } catch (e) {
    // fallthrough to Api-Key if configured
    if (!visionApiKey) throw e
  }

  if (!visionApiKey) throw new Error('No credentials for Vision: set YANDEX_VISION_API_KEY or IAM credentials')

  const data = await tryRequest({
    Authorization: `Api-Key ${visionApiKey}`,
    'Content-Type': 'application/json',
  })

  return flattenAllTextValues(data)
}

export function extractJsonLike(text: string): any {
  // Models sometimes wrap JSON in extra text; we try to extract the first {...} block.
  const match = text.match(/\{[\s\S]*\}/)
  const jsonText = match?.[0]
  if (!jsonText) throw new Error('No JSON object found in model output')
  return JSON.parse(jsonText)
}

