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
    const firstRes = await fetch(
      `${baseUrl}/products?per_page=100&status=publish&${auth}`,
      { headers: WC_FETCH_HEADERS }
    );

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
      totalSales: p.total_sales,
      variationCount: Array.isArray(p.variations) ? p.variations.length : 0,
      ticketTypes: p.attributes?.find(a => a.variation)?.options || [],
    }));

    res.status(200).json({ products, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message, fetchedAt: new Date().toISOString() });
  }
}
