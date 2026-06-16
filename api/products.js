export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

  const baseUrl = process.env.WC_BASE_URL;
  const key = process.env.WC_CONSUMER_KEY;
  const secret = process.env.WC_CONSUMER_SECRET;
  const auth = `consumer_key=${key}&consumer_secret=${secret}`;

  try {
    const firstRes = await fetch(
      `${baseUrl}/products?per_page=100&status=publish&${auth}`
    );

    if (!firstRes.ok) {
      throw new Error(`WooCommerce API error: ${firstRes.status}`);
    }

    const totalPages = parseInt(firstRes.headers.get('X-WP-TotalPages') || '1', 10);
    const firstPage = await firstRes.json();

    let allProducts = firstPage;

    if (totalPages > 1) {
      const pagePromises = [];
      for (let page = 2; page <= totalPages; page++) {
        pagePromises.push(
          fetch(`${baseUrl}/products?per_page=100&status=publish&page=${page}&${auth}`)
            .then(r => r.json())
        );
      }
      const additionalPages = await Promise.all(pagePromises);
      allProducts = [...firstPage, ...additionalPages.flat()];
    }

    const products = allProducts.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      regularPrice: p.regular_price,
      salePrice: p.sale_price,
      stockQuantity: p.stock_quantity,
      stockStatus: p.stock_status,
      manageStock: p.manage_stock,
      dateCreated: p.date_created,
      categories: p.categories.map(c => ({ id: c.id, name: c.name })),
      image: p.images?.[0]?.src || null,
      shortDescription: p.short_description,
      type: p.type,
    }));

    res.status(200).json({ products, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message, fetchedAt: new Date().toISOString() });
  }
}
