import { useEffect, useState, type FormEvent } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';

const client = generateClient<Schema>();

type Product = Schema['Product']['type'];
type CartItem = Schema['CartItem']['type'];
type Order = Schema['Order']['type'];

const css = `
  body { display: block; margin: 0; background: #fff; color: #1d2733; font-family: system-ui, sans-serif; }
  .shop { width: 100%; max-width: 1000px; margin: 0 auto; padding: 16px; box-sizing: border-box; text-align: left; }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  h1 { font-size: 1.6rem; margin: 0; }
  h2 { font-size: 1.2rem; margin: 28px 0 10px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }
  .card { border: 1px solid #d5dbe1; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
  .pic { width: 100%; height: 150px; object-fit: cover; border-radius: 6px; background: #e9edf1; }
  .price { font-weight: 600; }
  button { cursor: pointer; border: 0; border-radius: 6px; padding: 8px 12px; background: #0b6e6e; color: #fff; font-size: 0.95rem; }
  button.plain { background: #e9edf1; color: #1d2733; }
  button.danger { background: #b3261e; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #e3e7eb; }
  form.admin { display: grid; gap: 8px; max-width: 420px; }
  input, textarea { padding: 8px; border: 1px solid #b9c2cb; border-radius: 6px; font: inherit; }
  .note { background: #e6f4f1; padding: 10px 12px; border-radius: 6px; margin: 10px 0; }
  .muted { color: #5b6773; }
`;

function Shop({ signOut }: { signOut?: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', description: '', price: '', imageUrl: '' });

  async function refresh() {
    const [p, c, o] = await Promise.all([
      client.models.Product.list(),
      client.models.CartItem.list(),
      client.models.Order.list(),
    ]);
    setProducts(p.data);
    setCart(c.data);
    setOrders(o.data);
  }

  useEffect(() => {
    refresh();
    fetchAuthSession().then((session) => {
      const groups = session.tokens?.accessToken.payload['cognito:groups'] as string[] | undefined;
      setIsAdmin(Boolean(groups?.includes('Admins')));
    });
  }, []);

  const total = cart.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0);

  async function addToCart(product: Product) {
    const existing = cart.find((item) => item.productId === product.id);
    if (existing) {
      await client.models.CartItem.update({ id: existing.id, quantity: existing.quantity + 1 });
    } else {
      await client.models.CartItem.create({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
      });
    }
    await refresh();
  }

  async function removeFromCart(item: CartItem) {
    await client.models.CartItem.delete({ id: item.id });
    await refresh();
  }

  async function checkout() {
    if (cart.length === 0) return;
    await client.models.Order.create({
      items: JSON.stringify(
        cart.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity }))
      ),
      total,
      status: 'Pending',
    });
    await Promise.all(cart.map((i) => client.models.CartItem.delete({ id: i.id })));
    setMessage('Order placed. Payment is not connected yet, so this order is marked Pending.');
    await refresh();
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault();
    const price = Number(form.price);
    if (!form.name.trim() || Number.isNaN(price)) {
      setMessage('Enter a product name and a numeric price.');
      return;
    }
    await client.models.Product.create({
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      imageUrl: form.imageUrl.trim(),
    });
    setForm({ name: '', description: '', price: '', imageUrl: '' });
    setMessage('Product added.');
    await refresh();
  }

  async function deleteProduct(product: Product) {
    await client.models.Product.delete({ id: product.id });
    await refresh();
  }

  return (
    <div className="shop">
      <style>{css}</style>
      <div className="top">
        <h1>My Shop</h1>
        <button className="plain" onClick={signOut}>Sign out</button>
      </div>

      {message && <div className="note">{message}</div>}

      <h2>Products</h2>
      {products.length === 0 && (
        <p className="muted">
          {isAdmin ? 'No products yet. Add your first one below.' : 'No products yet. Check back soon.'}
        </p>
      )}
      <div className="grid">
        {products.map((p) => (
          <div className="card" key={p.id}>
            {p.imageUrl ? <img className="pic" src={p.imageUrl} alt={p.name} /> : <div className="pic" />}
            <strong>{p.name}</strong>
            <span className="muted">{p.description}</span>
            <span className="price">${p.price.toFixed(2)}</span>
            <button onClick={() => addToCart(p)}>Add to cart</button>
            {isAdmin && (
              <button className="danger" onClick={() => deleteProduct(p)}>Delete product</button>
            )}
          </div>
        ))}
      </div>

      <h2>Your cart</h2>
      {cart.length === 0 && <p className="muted">Your cart is empty.</p>}
      {cart.map((item) => (
        <div className="row" key={item.id}>
          <span>{item.name} x {item.quantity}</span>
          <span>
            ${((item.price ?? 0) * item.quantity).toFixed(2)}{' '}
            <button className="plain" onClick={() => removeFromCart(item)}>Remove</button>
          </span>
        </div>
      ))}
      {cart.length > 0 && (
        <p>
          <strong>Total: ${total.toFixed(2)}</strong>{' '}
          <button onClick={checkout}>Place order</button>
        </p>
      )}

      <h2>{isAdmin ? 'All orders' : 'Your orders'}</h2>
      {orders.length === 0 && <p className="muted">No orders yet.</p>}
      {orders.map((o) => (
        <div className="row" key={o.id}>
          <span>{new Date(o.createdAt).toLocaleString()}</span>
          <span>${o.total.toFixed(2)} ({o.status})</span>
        </div>
      ))}

      {isAdmin && (
        <>
          <h2>Add a product (admin)</h2>
          <form className="admin" onSubmit={addProduct}>
            <input
              placeholder="Product name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <input
              placeholder="Price, for example 19.99"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <input
              placeholder="Image link (optional)"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            />
            <button type="submit">Add product</button>
          </form>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Authenticator>
      {({ signOut }) => <Shop signOut={signOut} />}
    </Authenticator>
  );
}
