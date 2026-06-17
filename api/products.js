// Some WooCommerce hosts run bot-protection (e.g. Imunify360) that blocks
// requests lacking a browser-like Accept/User-Agent header with a 415.
const WC_FETCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; HerukaKmcDashboard/1.0)',
};

function getPeriodDates(period) {
  const today = new Date();
  const dateMax = today.toISOString().split('T')[0];
  const days = period === 'last_90_days' ? 90 : 30;
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  return { date_min: start.toISOString().split('T')[0], date_max: dateMax };
}

// The legacy `/reports/top_sellers` endpoint hardcodes its result limit to
// 12 products server-side (WooCommerce ignores any `limit` param), so most
// products in a larger catalogue always come back with zero sales regardless
// of the selected period. The Analytics `/wc-analytics/reports/products`
// endpoint reports real per-product, per-period totals for the whole
// catalogue (paginated), so we use that instead.
async function fetchPeriodSales(baseUrl, auth, date_min, date_max) {
  const analyticsBase = baseUrl.replace(/\/wc\/v\d+\/?$/, '/wc-analytics');
  const after = `${date_min}T00:00:00`;
  const before = `${date_max}T23:59:59`;
  const periodSales = new Map();

  try {
    const firstRes = await fetch(
      `${analyticsBase}/reports/products?per_page=100&after=${after}&before=${before}&${auth}`,
      { headers: WC_FETCH_HEADERS }
    );
    if (!firstRes.ok) return periodSales;

    const totalPages = parseInt(firstRes.headers.get('X-WP-TotalPages') || '1', 10);
    const firstPage = await firstRes.json();
    if (!Array.isArray(firstPage)) return periodSales;

    let allEntries = firstPage;

    if (totalPages > 1) {
      const pagePromises = [];
      for (let page = 2; page <= totalPages; page++) {
        pagePromises.push(
          fetch(
            `${analyticsBase}/reports/products?per_page=100&page=${page}&after=${after}&before=${before}&${auth}`,
            { headers: WC_FETCH_HEADERS }
          ).then(r => (r.ok ? r.json() : []))
        );
      }
      const additionalPages = await Promise.all(pagePromises);
      additionalPages.forEach(page => {
        if (Array.isArray(page)) allEntries = allEntries.concat(page);
      });
    }

    allEntries.forEach(entry => {
      if (entry && typeof entry.product_id !== 'undefined') {
        periodSales.set(entry.product_id, entry.items_sold || 0);
      }
    });
  } catch {
    // Leave periodSales empty — callers treat missing entries as 0 bookings.
  }

  return periodSales;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  const baseUrl = process.env.WC_BASE_URL;
  const key = process.env.WC_CONSUMER_KEY;
  const secret = process.env.WC_CONSUMER_SECRET;
  const auth = `consumer_key=${key}&consumer_secret=${secret}`;

  const period = req.query?.period || 'last_30_days';
  const { date_min, date_max } = getPeriodDates(period);

  try {
    const [firstRes, periodSales] = await Promise.all([
      fetch(
        `${baseUrl}/products?per_page=100&status=publish&${auth}`,
        { headers: WC_FETCH_HEADERS }
      ),
      fetchPeriodSales(baseUrl, auth, date_min, date_max),
    ]);

    if (!firstRes.ok) {
      throw new Error(`WooCommerce API error: ${firstRes.status}`);
    }

    const totalPages = parseInt(firstRes.headers.get('X-WP-TotalPages') || '1', 10);
    const firstPage = await firstRes.json();

    if (!Array.isArray(firstPage)) {
      throw new Error(firstPage?.message || 'Unexpected response from WooCommerce API');
    }

    let allProducts = firstPage;

    if (totalPages > 1) {
      const pagePromises = [];
      for (let page = 2; page <= totalPages; page++) {
        pagePromises.push(
          fetch(`${baseUrl}/products?per_page=100&status=publish&page=${page}&${auth}`, { headers: WC_FETCH_HEADERS })
            .then(r => r.json())
        );
      }
      const additionalPages = await Promise.all(pagePromises);
      additionalPages.forEach(page => {
        if (!Array.isArray(page)) {
          throw new Error(page?.message || 'Unexpected response from WooCommerce API');
        }
      });
      allProducts = [...firstPage, ...additionalPages.flat()];
    }

    const products = allProducts.map(p => ({
      id: p.id,
      name: p.name,
      permalink: p.permalink,
      price: p.price,
      regularPrice: p.regular_price,
      salePrice: p.sale_price,
      onSale: p.on_sale,
      dateOnSaleTo: p.date_on_sale_to,
      stockQuantity: p.stock_quantity,
      stockStatus: p.stock_status,
      manageStock: p.manage_stock,
      dateCreated: p.date_created,
      categories: p.categories.map(c => ({ id: c.id, name: c.name })),
      image: p.images?.[0]?.src || null,
      shortDescription: p.short_description,
      type: p.type,
      featured: p.featured,
      totalSales: periodSales.get(p.id) || 0,
      variationCount: Array.isArray(p.variations) ? p.variations.length : 0,
      ticketTypes: p.attributes?.find(a => a.variation)?.options || [],
    }));

    res.status(200).json({ products, period, date_min, date_max, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message, fetchedAt: new Date().toISOString() });
  }
}
