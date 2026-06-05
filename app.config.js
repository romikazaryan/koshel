const dotenv = require('dotenv');

dotenv.config({ override: true });

module.exports = ({ config }) => ({
  ...config,
  scheme: 'koshel',
  extra: {
    SUPABASE_URL: process.env.SUPABASE_URL ?? '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '',
    YANDEX_API_KEY: process.env.YANDEX_API_KEY ?? '',
    YANDEX_VISION_API_KEY: process.env.YANDEX_VISION_API_KEY ?? '',
  },
});
