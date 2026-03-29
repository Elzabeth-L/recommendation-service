const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003';
const CART_SERVICE = process.env.CART_SERVICE_URL || 'http://cart-service:3006';
const WISHLIST_SERVICE = process.env.WISHLIST_SERVICE_URL || 'http://wishlist-service:3007';
const ORDER_SERVICE = process.env.ORDER_SERVICE_URL || 'http://order-service:3008';

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'recommendation-service' }));

// Get personalized recommendations
app.get('/recommendations/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const categories = new Set();
    const excludeIds = new Set();

    // Get user's cart items
    try {
      const cartResp = await axios.get(`${CART_SERVICE}/cart/${userId}`);
      (cartResp.data.items || []).forEach(item => {
        excludeIds.add(item.productId);
      });
    } catch (e) { /* ignore */ }

    // Get user's wishlist
    try {
      const wishResp = await axios.get(`${WISHLIST_SERVICE}/wishlist/${userId}`);
      (wishResp.data.items || []).forEach(item => {
        excludeIds.add(item.productId);
      });
    } catch (e) { /* ignore */ }

    // Get user's order history
    try {
      const orderResp = await axios.get(`${ORDER_SERVICE}/orders/${userId}`);
      const orders = orderResp.data || [];
      orders.forEach(order => {
        (order.items || []).forEach(item => {
          excludeIds.add(item.productId);
        });
      });
    } catch (e) { /* ignore */ }

    // Get all products and filter
    const prodResp = await axios.get(`${PRODUCT_SERVICE}/products`, { params: { limit: 100 } });
    let products = prodResp.data.products || [];

    // Sort by rating and filter out already purchased/carted
    products = products
      .filter(p => !excludeIds.has(p._id))
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 12);

    res.json({ recommendations: products, count: products.length });
  } catch (err) {
    // Fallback: return featured products
    try {
      const prodResp = await axios.get(`${PRODUCT_SERVICE}/products`, { params: { featured: 'true', limit: 12 } });
      res.json({ recommendations: prodResp.data.products || [], count: prodResp.data.products?.length || 0 });
    } catch (e) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Get trending products (for non-logged-in users)
app.get('/trending', async (req, res) => {
  try {
    const prodResp = await axios.get(`${PRODUCT_SERVICE}/products`, { params: { sort: 'rating', limit: 12 } });
    res.json({ trending: prodResp.data.products || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3013;
app.listen(PORT, () => console.log(`Recommendation Service running on port ${PORT}`));
