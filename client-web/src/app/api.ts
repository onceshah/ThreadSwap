// API Integration Service connecting to Spring Boot + MongoDB Backend

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api/v1').replace(/\/$/, '');

export async function fetchProductsFromBackend(lat = 19.1363, lng = 72.8277, radius = 50.0) {
  try {
    const res = await fetch(`${API_BASE_URL}/products?latitude=${lat}&longitude=${lng}&radius=${radius}`);
    if (!res.ok) throw new Error('Failed to fetch backend products');
    const data = await res.json();
    return data.map((item: any) => ({
      id: item.id,
      name: item.title,
      seller: item.sellerName || 'Anonymous',
      sellerEmail: item.sellerEmail || '',
      sellerAvatar: (item.sellerName || 'A').slice(0, 2).toUpperCase(),
      price: item.price,
      condition: item.condition,
      type: item.transactionType === 'SELL' ? 'Sell' : item.transactionType === 'EXCHANGE' ? 'Exchange' : 'Free/Donate',
      distance: 'Within radius', // We can compute real distance if needed
      image: (item.images && item.images.length > 0) ? item.images[0].url : 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=600&fit=crop&auto=format',
      category: item.categoryName || 'Tops',
      rating: 4.8,
      reviews: 12,
      description: item.description,
      location: item.locationName || (item.latitude && item.longitude ? `${item.latitude.toFixed(2)}°, ${item.longitude.toFixed(2)}°` : 'Nearby'),
      lat: item.latitude,
      lng: item.longitude
    }));
  } catch (err) {
    console.warn('Backend API offline or unreachable, using pre-loaded products fallback.', err);
    return null;
  }
}

export async function registerBackend(firstName: string, lastName: string, email: string, pass: string) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: firstName || 'Priya',
      lastName: lastName || 'Sharma',
      email,
      password: pass
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || 'Registration failed. Email may already be in use.');
  }
  const data = await res.json();
  if (data.accessToken) {
    localStorage.setItem('token', data.accessToken);
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || email;
    localStorage.setItem('authUser', JSON.stringify({ name: displayName, email }));
  }
  return data;
}

export async function loginBackend(email: string, pass: string): Promise<{ accessToken?: string; user?: { firstName?: string; lastName?: string; email?: string }; firstName?: string; lastName?: string; email?: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || 'Invalid email or password');
  }
  const data = await res.json();
  if (data.accessToken) {
    localStorage.setItem('token', data.accessToken);
    // Use firstName/lastName directly from the response body (more reliable than JWT decode)
    const firstName = data.firstName || '';
    const lastName = data.lastName || '';
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || email;
    localStorage.setItem('authUser', JSON.stringify({
      name: displayName,
      email: data.email || email
    }));
  }
  return data;
}

export async function createListingBackend(productData: any) {
  try {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const storedUser = localStorage.getItem('authUser');
    const authUser = storedUser ? JSON.parse(storedUser) : null;

    const requestPayload = {
      title: productData.name || 'Pre-loved Item',
      description: productData.description || 'Quality pre-loved item listed on ReWear marketplace.',
      price: typeof productData.price === 'number' && !isNaN(productData.price) ? productData.price : 500,
      condition: productData.condition || 'Gently Used',
      transactionType: productData.type === 'Sell' ? 'SELL' : productData.type === 'Exchange' ? 'EXCHANGE' : 'DONATE',
      categoryId: productData.category || 'Tops',
      latitude: typeof productData.lat === 'number' ? productData.lat : 19.1363,
      longitude: typeof productData.lng === 'number' ? productData.lng : 72.8277,
      images: [{ url: productData.image || 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&h=600&fit=crop&auto=format' }],
      sellerName: productData.seller || authUser?.name || 'Anonymous',
      sellerEmail: productData.sellerEmail || authUser?.email || ''
    };

    let res = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestPayload)
    });

    if (!res.ok) {
      console.warn(`Initial POST /products returned ${res.status}. Retrying unauthenticated payload.`);
      res = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`Backend POST /products failed: ${errText}. Saving product locally.`);
      return { id: Date.now(), ...productData };
    }

    const createdProduct = await res.json();
    return {
      id: createdProduct.id || Date.now(),
      name: createdProduct.title || productData.name,
      price: createdProduct.price ?? productData.price,
      type: createdProduct.transactionType === 'SELL' ? 'Sell' : createdProduct.transactionType === 'EXCHANGE' ? 'Exchange' : 'Free/Donate',
      condition: createdProduct.condition || productData.condition,
      category: createdProduct.categoryName || productData.category,
      description: createdProduct.description || productData.description,
      image: (createdProduct.images && createdProduct.images.length > 0) ? createdProduct.images[0].url : productData.image,
      seller: createdProduct.sellerName || productData.seller || 'Priya Sharma',
      sellerAvatar: (createdProduct.sellerName || productData.seller || 'Priya Sharma').slice(0, 2).toUpperCase(),
      lat: createdProduct.latitude ?? productData.lat,
      lng: createdProduct.longitude ?? productData.lng,
      location: productData.location || 'Andheri West, Mumbai',
      distance: '0.4 km',
      rating: 5.0,
      reviews: 1
    };
  } catch (err) {
    console.warn('Backend API error during product creation. Saving locally:', err);
    return { id: Date.now(), ...productData };
  }
}

export async function delistProductBackend(productId: string | number, sellerHandle?: string) {
  try {
    const url = sellerHandle 
      ? `${API_BASE_URL}/products/${productId}?sellerHandle=${encodeURIComponent(sellerHandle)}`
      : `${API_BASE_URL}/products/${productId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    if (!res.ok) {
      console.warn('Backend delist forbidden or failed:', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Backend delete offline, deleted locally.', err);
    return true;
  }
}

export async function updateProductStatusBackend(productId: string | number, status: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${productId}/status?status=${status}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    if (!res.ok) throw new Error('Status update failed');
    return await res.json();
  } catch (err) {
    console.warn('Backend status update offline.', err);
    return null;
  }
}

export async function fetchChatMessagesBackend(threadKey: string, user1?: string, user2?: string, product?: string) {
  try {
    let url = `${API_BASE_URL}/chat-messages?threadKey=${encodeURIComponent(threadKey)}`;
    if (user1) url += `&user1=${encodeURIComponent(user1)}`;
    if (user2) url += `&user2=${encodeURIComponent(user2)}`;
    if (product) url += `&product=${encodeURIComponent(product)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch chat messages from backend:', err);
    return [];
  }
}

export async function sendChatMessageBackend(threadKey: string, senderName: string, text: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/chat-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threadKey, senderName, text })
    });
    if (!res.ok) throw new Error('Failed to send message');
    return await res.json();
  } catch (err) {
    console.error('Failed to send chat message:', err);
    return null;
  }
}

export async function fetchUserChatThreadsBackend(userName: string, userEmail?: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/chat-messages/my-threads?userName=${encodeURIComponent(userName)}&userEmail=${encodeURIComponent(userEmail || '')}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('Failed to fetch user chat threads:', err);
    return [];
  }
}

export function getCleanUserHandle(str?: string | null): string {
  if (!str) return 'Guest';
  let s = str.trim();
  if (s.includes('@')) {
    s = s.split('@')[0];
  }
  s = s.split(' ')[0];
  const cleanAlpha = s.replace(/[0-9._-]/g, '');
  if (cleanAlpha.length >= 2) {
    s = cleanAlpha;
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function buildThreadKey(user1Str: string, user2Str: string): string {
  const u1 = getCleanUserHandle(user1Str);
  const u2 = getCleanUserHandle(user2Str);
  const sortedUsers = [u1, u2].sort();
  return `${sortedUsers[0]}<->${sortedUsers[1]}`;
}

export async function aiSemanticSearchBackend(query: string, maxPrice?: number) {
  try {
    const res = await fetch(`${API_BASE_URL}/products/ai-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, maxPrice })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function deleteThreadBackend(user1: string, user2: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/chat-messages/thread?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to delete thread from backend:', err);
    return false;
  }
}

export async function clearAllChatMessagesBackend() {
  try {
    const res = await fetch(`${API_BASE_URL}/chat-messages/clear-all`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to clear chat messages from backend:', err);
    return false;
  }
}

