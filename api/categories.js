// Some WooCommerce hosts run bot-protection (e.g. Imunify360) that blocks
// requests lacking a browser-like Accept/User-Agent header with a 415.
const WC_FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; HerukaKmcDashboard/1.0)',
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  const baseUrl = process.env.WC_BASE_URL;
  const key = process.env.WC_CONSUMER_KEY;
  const secret = process.env.WC_CONSUMER_SECRET;
  const auth = `consumer_key=${key}&consumer_secret=${secret}`;

  try {
    const response = await fetch(
      `${baseUrl}/products/categories?per_page=100&${auth}`,
      { headers: WC_FETCH_HEADERS }
    );

    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(data?.message || 'Unexpected response from WooCommerce API');
    }

    const categories = data.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      count: c.count,
    }));

    res.status(200).json({ categories, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message, fetchedAt: new Date().toISOString() });
  }
}
