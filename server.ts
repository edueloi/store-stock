import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import knex from "knex";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "nexus-super-secret-key-123";

// Database setup (Targeting MySQL/MariaDB compatible schema)
// For development in this environment, we use better-sqlite3 for better compatibility
const db = knex({
  client: 'better-sqlite3',
  connection: {
    filename: './nexus_erp.sqlite'
  },
  useNullAsDefault: true
});

// Initialize database schema
async function initDb() {
  const hasTenants = await db.schema.hasTable('tenants');
  if (!hasTenants) {
    await db.schema.createTable('tenants', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('slug').unique().notNullable(); // For storefront URL: /s/:slug
      table.string('whatsapp').notNullable();
      table.string('logo_url');
      table.string('banner_url');
      table.string('instagram_url');
      table.string('facebook_url');
      table.string('address');
      table.boolean('show_address').defaultTo(true);
      table.string('template_id').defaultTo('minimal');
      table.text('about_text');
      table.text('footer_text');
      table.string('primary_color').defaultTo('#000000');
      table.timestamps(true, true);
    });
  } else {
    // Add missing tenant columns
    const columns = await db('tenants').columnInfo();
    if (!columns.about_text) {
      await db.schema.table('tenants', (table) => {
        table.string('banner_url');
        table.string('instagram_url');
        table.string('facebook_url');
        table.string('address');
        table.boolean('show_address').defaultTo(true);
        table.string('template_id').defaultTo('minimal');
        table.text('about_text');
        table.text('footer_text');
      });
    }
  }

  const hasUsers = await db.schema.hasTable('users');
  if (!hasUsers) {
    await db.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().references('id').inTable('tenants');
      table.string('name').notNullable();
      table.string('email').unique().notNullable();
      table.string('password').notNullable();
      table.string('role').notNullable().defaultTo('admin'); // admin, seller, staff
      table.timestamps(true, true);
    });
  }

  const hasCategories = await db.schema.hasTable('categories');
  if (!hasCategories) {
    await db.schema.createTable('categories', (table) => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().references('id').inTable('tenants');
      table.string('name').notNullable();
      table.timestamps(true, true);
    });
  }

  const hasProducts = await db.schema.hasTable('products');
  if (!hasProducts) {
    await db.schema.createTable('products', (table) => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().references('id').inTable('tenants');
      table.integer('category_id').unsigned().references('id').inTable('categories');
      table.string('name').notNullable();
      table.string('sku');
      table.text('description');
      table.decimal('price', 10, 2).notNullable();
      table.decimal('cost_price', 10, 2).defaultTo(0);
      table.decimal('discount_price', 10, 2);
      table.integer('stock_quantity').defaultTo(0);
      table.string('image_url');
      table.date('expiry_date'); // Nullable for non-perishables
      table.string('type').defaultTo('sale'); // 'sale' or 'internal'
      table.boolean('is_active').defaultTo(true);
      table.boolean('is_featured').defaultTo(false);
      table.json('variations');
      table.timestamps(true, true);
    });
  } else {
    const columns = await db('products').columnInfo();
    if (!columns.type) {
      await db.schema.table('products', (table) => {
        table.string('sku');
        table.string('type').defaultTo('sale');
        table.decimal('discount_price', 10, 2);
        table.boolean('is_featured').defaultTo(false);
        table.json('variations');
      });
    } else if (!columns.variations) {
       await db.schema.table('products', (table) => {
         table.json('variations');
       });
    }
  }

  const hasOrders = await db.schema.hasTable('orders');
  if (!hasOrders) {
    await db.schema.createTable('orders', (table) => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().references('id').inTable('tenants');
      table.string('customer_name');
      table.string('customer_phone');
      table.string('customer_address');
      table.decimal('total_amount', 10, 2).notNullable();
      table.string('status').defaultTo('pending'); // pending, completed, cancelled
      table.string('payment_method');
      table.timestamps(true, true);
    });
  }

  const hasOrderItems = await db.schema.hasTable('order_items');
  if (!hasOrderItems) {
    await db.schema.createTable('order_items', (table) => {
      table.increments('id').primary();
      table.integer('order_id').unsigned().references('id').inTable('orders');
      table.integer('product_id').unsigned().references('id').inTable('products');
      table.integer('quantity').notNullable();
      table.decimal('unit_price', 10, 2).notNullable();
    });
  }

  const hasStockMovements = await db.schema.hasTable('stock_movements');
  if (!hasStockMovements) {
    await db.schema.createTable('stock_movements', (table) => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().references('id').inTable('tenants');
      table.integer('product_id').unsigned().references('id').inTable('products');
      table.integer('quantity').notNullable(); // positive for addition, negative for subtraction
      table.string('type').notNullable(); // purchase, sale, adjustment, loss, return
      table.string('reason');
      table.timestamps(true, true);
    });
  }

  const hasFinance = await db.schema.hasTable('finance');
  if (!hasFinance) {
    await db.schema.createTable('finance', (table) => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().references('id').inTable('tenants');
      table.string('type').notNullable(); // income, expense
      table.string('description').notNullable();
      table.decimal('amount', 10, 2).notNullable();
      table.date('date').notNullable();
      table.string('category');
      table.timestamps(true, true);
    });
  }

  const hasCustomers = await db.schema.hasTable('customers');
  if (!hasCustomers) {
    await db.schema.createTable('customers', (table) => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().references('id').inTable('tenants');
      table.string('name').notNullable();
      table.string('email');
      table.string('phone');
      table.string('document'); // CPF/CNPJ
      table.string('address');
      table.text('notes');
      table.timestamps(true, true);
    });
  }

  const hasSuppliers = await db.schema.hasTable('suppliers');
  if (!hasSuppliers) {
    await db.schema.createTable('suppliers', (table) => {
      table.increments('id').primary();
      table.integer('tenant_id').unsigned().references('id').inTable('tenants');
      table.string('name').notNullable();
      table.string('category').notNullable(); // What they provide
      table.string('contact_person');
      table.string('phone');
      table.string('address');
      table.text('notes');
      table.timestamps(true, true);
    });
  }

  // Seed default categories if needed
  const demoTenant = await db('tenants').where({ slug: 'demo' }).first();
  if (!demoTenant) {
     const [tid] = await db('tenants').insert({ name: 'Nexus Demo', slug: 'demo', whatsapp: '5511999999999' });
     await db('categories').insert([
       { tenant_id: tid, name: 'Eletrônicos' },
       { tenant_id: tid, name: 'Vestuário' },
       { tenant_id: tid, name: 'Cosméticos' },
       { tenant_id: tid, name: 'Acessórios' }
     ]);
     const hashed = await bcrypt.hash('admin123', 10);
     await db('users').insert({
       tenant_id: tid,
       name: 'Demo Admin',
       email: 'admin@nexus.com',
       password: hashed,
       role: 'admin'
     });
  }
}

app.use(cors());
app.use(express.json());

// Initialize database schema
initDb().catch(err => {
  console.error("Critical: Database initialization failed:", err);
  process.exit(1);
});

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- API ROUTES ---

// Public Storefront Init
app.get("/api/public/store/:slug", async (req, res) => {
  try {
    const tenant = await db('tenants').where({ slug: req.params.slug }).first();
    if (!tenant) return res.status(404).json({ error: "Store not found" });

    const categories = await db('categories').where({ tenant_id: tenant.id });
    const products = await db('products').where({ tenant_id: tenant.id, is_active: true });

    res.json({ tenant, categories, products });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch store" });
  }
});

// Checkout (Generates WhatsApp message link or saves order)
app.post("/api/public/checkout", async (req, res) => {
  const { tenantId, items, customerInfo } = req.body;
  try {
    const tenant = await db('tenants').where({ id: tenantId }).first();
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await db('products').where({ id: item.id }).first();
      if (product) {
        total += product.price * item.quantity;
        orderItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: product.price
        });
      }
    }

    const [orderId] = await db('orders').insert({
      tenant_id: tenantId,
      customer_name: customerInfo.name,
      customer_phone: customerInfo.phone,
      customer_address: customerInfo.address,
      total_amount: total,
      status: 'pending',
      payment_method: customerInfo.paymentMethod
    });

    for (const item of orderItems) {
      await db('order_items').insert({
        order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      });
      // Optionally decrease stock
      await db('products').where({ id: item.product_id }).decrement('stock_quantity', item.quantity);
    }

    res.json({ success: true, orderId });
  } catch (error) {
    res.status(500).json({ error: "Checkout failed" });
  }
});

// Admin Auth
app.post("/api/auth/register-tenant", async (req, res) => {
  const { tenantName, slug, whatsapp, userName, email, password } = req.body;
  try {
    const existingTenant = await db('tenants').where({ slug }).first();
    if (existingTenant) return res.status(400).json({ error: "Slug already exists" });

    const [tenantId] = await db('tenants').insert({
      name: tenantName,
      slug,
      whatsapp
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [userId] = await db('users').insert({
      tenant_id: tenantId,
      name: userName,
      email,
      password: hashedPassword,
      role: 'admin'
    });

    const token = jwt.sign({ userId, tenantId, role: 'admin' }, JWT_SECRET);
    res.json({ token, tenantId });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(400).json({ error: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ userId: user.id, tenantId: user.tenant_id, role: user.role }, JWT_SECRET);
    res.json({ token, user: { name: user.name, email: user.email, role: user.role, tenantId: user.tenant_id } });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// --- PROTECTED ROUTES ---

// Products CRUD
app.get("/api/products", authenticateToken, async (req: any, res) => {
  try {
    const products = await db('products')
      .where({ tenant_id: req.user.tenantId })
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .select('products.*', 'categories.name as category_name');
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.post("/api/products", authenticateToken, async (req: any, res) => {
  try {
    const data = { ...req.body };
    if (data.variations) data.variations = JSON.stringify(data.variations);
    
    const [id] = await db('products').insert({
      ...data,
      tenant_id: req.user.tenantId
    });
    res.json({ id });
  } catch (error) {
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.put("/api/products/:id", authenticateToken, async (req: any, res) => {
  try {
    const data = { ...req.body };
    if (data.variations) data.variations = JSON.stringify(data.variations);
    
    await db('products')
      .where({ id: req.params.id, tenant_id: req.user.tenantId })
      .update(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/api/products/:id", authenticateToken, async (req: any, res) => {
  try {
    await db('products').where({ id: req.params.id, tenant_id: req.user.tenantId }).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Stock Management
app.post("/api/products/stock-adjustment", authenticateToken, async (req: any, res) => {
  const { productId, quantity, type, reason } = req.body;
  try {
    const product = await db('products').where({ id: productId, tenant_id: req.user.tenantId }).first();
    if (!product) return res.status(404).json({ error: "Product not found" });

    await db.transaction(async (trx) => {
      await trx('products')
        .where({ id: productId })
        .update({ stock_quantity: product.stock_quantity + quantity });

      await trx('stock_movements').insert({
        tenant_id: req.user.tenantId,
        product_id: productId,
        quantity,
        type,
        reason
      });
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Stock adjustment failed" });
  }
});

app.get("/api/products/movements", authenticateToken, async (req: any, res) => {
  try {
    const movements = await db('stock_movements')
      .where({ 'stock_movements.tenant_id': req.user.tenantId })
      .join('products', 'stock_movements.product_id', 'products.id')
      .select('stock_movements.*', 'products.name as product_name')
      .orderBy('stock_movements.created_at', 'desc')
      .limit(50);
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch movements" });
  }
});

// Categories
app.get("/api/categories", authenticateToken, async (req: any, res) => {
  const categories = await db('categories').where({ tenant_id: req.user.tenantId });
  res.json(categories);
});

app.post("/api/categories", authenticateToken, async (req: any, res) => {
  const [id] = await db('categories').insert({ name: req.body.name, tenant_id: req.user.tenantId });
  res.json({ id });
});

// Orders (Admin side)
app.get("/api/orders", authenticateToken, async (req: any, res) => {
  const orders = await db('orders')
    .where({ tenant_id: req.user.tenantId })
    .orderBy('created_at', 'desc');
  res.json(orders);
});

app.get("/api/orders/:id", authenticateToken, async (req: any, res) => {
  try {
    const order = await db('orders')
      .where({ id: req.params.id, tenant_id: req.user.tenantId })
      .first();
    if (!order) return res.status(404).json({ error: "Order not found" });

    const items = await db('order_items')
      .where({ order_id: order.id })
      .join('products', 'order_items.product_id', 'products.id')
      .select('order_items.*', 'products.name as product_name');

    res.json({ ...order, items });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order details" });
  }
});

app.put("/api/orders/:id/status", authenticateToken, async (req: any, res) => {
  const { status } = req.body;
  try {
    await db('orders')
      .where({ id: req.params.id, tenant_id: req.user.tenantId })
      .update({ status });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// Customers (CRM)
app.get("/api/customers", authenticateToken, async (req: any, res) => {
  const customers = await db('customers').where({ tenant_id: req.user.tenantId });
  res.json(customers);
});

app.post("/api/customers", authenticateToken, async (req: any, res) => {
  const [id] = await db('customers').insert({
    ...req.body,
    tenant_id: req.user.tenantId
  });
  res.json({ id });
});

// Analytics
app.get("/api/stats/top-selling", authenticateToken, async (req: any, res) => {
  try {
    const topProducts = await db('order_items')
      .join('orders', 'order_items.order_id', 'orders.id')
      .join('products', 'order_items.product_id', 'products.id')
      .where({ 'orders.tenant_id': req.user.tenantId, 'orders.status': 'completed' })
      .select('products.name', db.raw('SUM(order_items.quantity) as total_sold'))
      .groupBy('products.id', 'products.name')
      .orderBy('total_sold', 'desc')
      .limit(5);
    res.json(topProducts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch top selling products" });
  }
});

// PDV Sale (Point Of Sale)
app.post("/api/sales", authenticateToken, async (req: any, res) => {
  const { items, customerName, totalAmount } = req.body;
  try {
    const [orderId] = await db('orders').insert({
      tenant_id: req.user.tenantId,
      customer_name: customerName || "Balcão",
      total_amount: totalAmount,
      status: 'completed',
      payment_method: 'money'
    });

    for (const item of items) {
      await db('order_items').insert({
        order_id: orderId,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price
      });
      await db('products').where({ id: item.id }).decrement('stock_quantity', item.quantity);
    }

    // Record income in finance
    await db('finance').insert({
      tenant_id: req.user.tenantId,
      type: 'income',
      description: `Venda PDV #${orderId}`,
      amount: totalAmount,
      date: new Date().toISOString().split('T')[0]
    });

    res.json({ success: true, orderId });
  } catch (error) {
    res.status(500).json({ error: "Sale failed" });
  }
});

// Suppliers API
app.get("/api/suppliers", authenticateToken, async (req: any, res) => {
  try {
    const suppliers = await db('suppliers').where({ tenant_id: req.user.tenantId }).orderBy('name', 'asc');
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});

app.post("/api/suppliers", authenticateToken, async (req: any, res) => {
  try {
    const [id] = await db('suppliers').insert({
      ...req.body,
      tenant_id: req.user.tenantId
    });
    res.json({ id });
  } catch (error) {
    res.status(500).json({ error: "Failed to create supplier" });
  }
});

app.put("/api/suppliers/:id", authenticateToken, async (req: any, res) => {
  try {
    await db('suppliers').where({ id: req.params.id, tenant_id: req.user.tenantId }).update(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update supplier" });
  }
});

app.delete("/api/suppliers/:id", authenticateToken, async (req: any, res) => {
  try {
    await db('suppliers').where({ id: req.params.id, tenant_id: req.user.tenantId }).del();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete supplier" });
  }
});

// Finance CRUD
app.get("/api/finance", authenticateToken, async (req: any, res) => {
  const entries = await db('finance')
    .where({ tenant_id: req.user.tenantId })
    .orderBy('date', 'desc');
  res.json(entries);
});

app.post("/api/finance", authenticateToken, async (req: any, res) => {
  const [id] = await db('finance').insert({
    ...req.body,
    tenant_id: req.user.tenantId
  });
  res.json({ id });
});

// Tenant Management
app.get("/api/tenant", authenticateToken, async (req: any, res) => {
  const tenant = await db('tenants').where({ id: req.user.tenantId }).first();
  res.json(tenant);
});

app.put("/api/tenant", authenticateToken, async (req: any, res) => {
  await db('tenants').where({ id: req.user.tenantId }).update({
    name: req.body.name,
    whatsapp: req.body.whatsapp,
    slug: req.body.slug,
    about_text: req.body.about_text,
    footer_text: req.body.footer_text,
    logo_url: req.body.logo_url,
    banner_url: req.body.banner_url,
    instagram_url: req.body.instagram_url,
    facebook_url: req.body.facebook_url,
    address: req.body.address,
    show_address: req.body.show_address,
    template_id: req.body.template_id,
    primary_color: req.body.primary_color
  });
  res.json({ message: "Tenant updated" });
});

// Dashboard Stats
app.get("/api/stats", authenticateToken, async (req: any, res) => {
  const tenantId = req.user.tenantId;
  try {
    const totalSales = await db('orders').where({ tenant_id: tenantId, status: 'completed' }).sum('total_amount as total').first() as any;
    const totalExpenses = await db('finance').where({ tenant_id: tenantId, type: 'expense' }).sum('amount as total').first() as any;
    const stockValue = await db('products')
      .where({ tenant_id: tenantId })
      .select(db.raw('SUM(stock_quantity * cost_price) as total'))
      .first() as any;

    const salesOverTime = await db('orders')
      .where({ tenant_id: tenantId, status: 'completed' })
      .select(db.raw('DATE(created_at) as date'), db.raw('SUM(total_amount) as total'))
      .groupBy('date')
      .limit(7);

    res.json({
      summary: {
        revenue: totalSales?.total || 0,
        expenses: totalExpenses?.total || 0,
        stockValue: stockValue?.total || 0,
        profit: (totalSales?.total || 0) - (totalExpenses?.total || 0)
      },
      salesOverTime
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// --- VITE SETUP ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
