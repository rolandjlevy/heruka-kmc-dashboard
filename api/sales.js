function getPeriodDates(period) {
  const today = new Date();
  const dateMax = today.toISOString().split('T')[0];
  const days = period === 'last_90_days' ? 90 : 30;
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  return { date_min: start.toISOString().split('T')[0], date_max: dateMax };
}

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

  const period = req.query?.period || 'last_30_days';
  const { date_min, date_max } = getPeriodDates(period);

  try {
    const response = await fetch(
      `${baseUrl}/reports/sales?date_min=${date_min}&date_max=${date_max}&${auth}`,
      { headers: WC_FETCH_HEADERS }
    );

    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    const json = await response.json();

    if (!Array.isArray(json) && json?.message) {
      throw new Error(json.message);
    }

    const data = Array.isArray(json) ? (json[0] || {}) : json;

    res.status(200).json({
      total_sales: data.total_sales,
      net_sales: data.net_sales,
      average_sales: data.average_sales,
      total_orders: data.total_orders,
      total_items: data.total_items,
      total_tax: data.total_tax,
      total_shipping: data.total_shipping,
      total_discount: data.total_discount,
      totals: data.totals || {},
      period,
      date_min,
      date_max,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message, fetchedAt: new Date().toISOString() });
  }
}
