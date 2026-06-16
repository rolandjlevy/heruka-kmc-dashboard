export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  const baseUrl = process.env.WC_BASE_URL;
  const key = process.env.WC_CONSUMER_KEY;
  const secret = process.env.WC_CONSUMER_SECRET;
  const auth = `consumer_key=${key}&consumer_secret=${secret}`;

  try {
    const response = await fetch(
      `${baseUrl}/reports/top_sellers?period=month&${auth}`
    );

    if (!response.ok) {
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    const data = await response.json();

    const topSellers = data.map(s => ({
      title: s.title,
      productId: s.product_id,
      quantity: s.quantity,
    }));

    res.status(200).json({ topSellers, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message, fetchedAt: new Date().toISOString() });
  }
}
