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
    const [ordersRes, productsRes, customersRes, reviewsRes] = await Promise.all([
      fetch(`${baseUrl}/reports/orders/totals?${auth}`, { headers: WC_FETCH_HEADERS }),
      fetch(`${baseUrl}/reports/products/totals?${auth}`, { headers: WC_FETCH_HEADERS }),
      fetch(`${baseUrl}/reports/customers/totals?${auth}`, { headers: WC_FETCH_HEADERS }),
      fetch(`${baseUrl}/reports/reviews/totals?${auth}`, { headers: WC_FETCH_HEADERS }),
    ]);

    for (const r of [ordersRes, productsRes, customersRes, reviewsRes]) {
      if (!r.ok) throw new Error(`WooCommerce API error: ${r.status}`);
    }

    const [orders, products, customers, reviews] = await Promise.all([
      ordersRes.json(),
      productsRes.json(),
      customersRes.json(),
      reviewsRes.json(),
    ]);

    for (const [label, value] of [['orders', orders], ['products', products], ['customers', customers], ['reviews', reviews]]) {
      if (!Array.isArray(value)) {
        throw new Error(value?.message || `Unexpected response from WooCommerce API (${label})`);
      }
    }

    res.status(200).json({
      orders,
      products,
      customers,
      reviews,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message, fetchedAt: new Date().toISOString() });
  }
}
