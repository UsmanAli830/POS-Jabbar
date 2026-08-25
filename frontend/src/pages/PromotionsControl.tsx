import React, { useState, useEffect } from 'react';
import { Tag, Save, Trash2, Edit2, CheckCircle, AlertTriangle, X } from 'lucide-react';

type TradeOffer = {
  id: number;
  offerName: string;
  offerType: string;
  targetType: string;
  targetId: number | null;
  targetName?: string;
  conditionValue: number;
  rewardValue: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
  isExpired?: boolean;
  statusLabel?: string;
};

const PromotionsControl: React.FC = () => {
  const [offers, setOffers] = useState<TradeOffer[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: number; productName: string }[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    offerName: '',
    offerType: 'PERCENTAGE_DISCOUNT',
    targetType: 'ALL_PRODUCTS',
    targetId: '',
    conditionValue: '1',
    rewardValue: '10',
    isActive: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchOffers();
    fetchMasterData();
  }, []);

  const fetchOffers = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/promotions');
      if (res.ok) setOffers(await res.json());
    } catch (e) {
      console.error('Failed to fetch promotions', e);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch('http://localhost:3000/api/master-data-post/categories'),
        fetch('http://localhost:3000/api/products')
      ]);
      if (catRes.ok) setCategories(await catRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch (e) {
      console.error('Failed to fetch categories/products', e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
  };

  const handleEdit = (offer: TradeOffer) => {
    setEditingId(offer.id);
    setFormData({
      offerName: offer.offerName,
      offerType: offer.offerType,
      targetType: offer.targetType,
      targetId: offer.targetId ? String(offer.targetId) : '',
      conditionValue: String(offer.conditionValue),
      rewardValue: String(offer.rewardValue),
      isActive: offer.isActive,
      startDate: new Date(offer.startDate).toISOString().split('T')[0],
      endDate: new Date(offer.endDate).toISOString().split('T')[0]
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
      offerName: '',
      offerType: 'PERCENTAGE_DISCOUNT',
      targetType: 'ALL_PRODUCTS',
      targetId: '',
      conditionValue: '1',
      rewardValue: '10',
      isActive: true,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        targetId: formData.targetId ? Number(formData.targetId) : null,
        conditionValue: Number(formData.conditionValue || 1),
        rewardValue: Number(formData.rewardValue || 0),
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString()
      };

      const url = editingId 
        ? `http://localhost:3000/api/promotions/${editingId}`
        : 'http://localhost:3000/api/promotions';

      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert(editingId ? 'Promotion updated successfully!' : 'Promotion created successfully!');
        fetchOffers();
        handleCancelEdit();
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'Failed to save promotion'));
      }
    } catch (e) {
      alert('Network error while saving promotion');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this promotion?')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/promotions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchOffers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="page-wrapper space-y-6 flex flex-col h-full p-4">
      <div className="mt-6 pt-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Promotions & Trade Offers</h1>
        <p className="text-sm text-gray-500 mb-6">Configure campaign promo discounts, volume pricing, and promotional schemes.</p>
      </div>

      <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
        {/* LEFT COLUMN: PROMOTION CREATION / EDIT FORM */}
        <div className="glass-panel p-6" style={{ width: '380px', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', color: '#8b5cf6', fontWeight: 800, fontSize: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={18} /> {editingId ? 'Edit Promotion' : 'Create Promotion'}
            </div>
            {editingId && (
              <button onClick={handleCancelEdit} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={16} />
              </button>
            )}
          </div>
          
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Promotion Name *</label>
              <input required className="form-input" name="offerName" value={formData.offerName} onChange={handleChange} placeholder="e.g. Eid Special 10% Off" style={{ height: '30px', fontSize: '12px' }} />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Promotion Type *</label>
              <select className="form-select" name="offerType" value={formData.offerType} onChange={handleChange} style={{ height: '30px', fontSize: '12px' }}>
                <option value="PERCENTAGE_DISCOUNT">Percentage Discount (%)</option>
                <option value="CASH_DISCOUNT">Cash Discount (Rs.)</option>
                <option value="BUY_X_GET_Y">Buy X Get Y Free (BOGO)</option>
                <option value="MIN_QTY_DISCOUNT">Minimum Qty Discount</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Target Scope *</label>
              <select className="form-select" name="targetType" value={formData.targetType} onChange={handleChange} style={{ height: '30px', fontSize: '12px' }}>
                <option value="ALL_PRODUCTS">All Products</option>
                <option value="CATEGORY">Specific Category</option>
                <option value="PRODUCT">Specific Product</option>
              </select>
            </div>

            {formData.targetType === 'CATEGORY' && (
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Select Category *</label>
                <select required className="form-select" name="targetId" value={formData.targetId} onChange={handleChange} style={{ height: '30px', fontSize: '12px' }}>
                  <option value="">-- Choose Category --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {formData.targetType === 'PRODUCT' && (
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Select Product *</label>
                <select required className="form-select" name="targetId" value={formData.targetId} onChange={handleChange} style={{ height: '30px', fontSize: '12px' }}>
                  <option value="">-- Choose Product --</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.productName}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Min Qty to Trigger</label>
                <input required type="number" min="1" className="form-input" name="conditionValue" value={formData.conditionValue} onChange={handleChange} style={{ height: '30px', fontSize: '12px' }} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>
                  {formData.offerType === 'PERCENTAGE_DISCOUNT' ? 'Discount %' : formData.offerType === 'BUY_X_GET_Y' ? 'Free Qty (Bonus)' : 'Discount Amount (Rs)'}
                </label>
                <input required type="number" step="0.01" min="0" className="form-input" name="rewardValue" value={formData.rewardValue} onChange={handleChange} style={{ height: '30px', fontSize: '12px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Valid From</label>
                <input required type="date" className="form-input" name="startDate" value={formData.startDate} onChange={handleChange} style={{ height: '30px', fontSize: '11px' }} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '11px', fontWeight: 700 }}>Valid Until</label>
                <input required type="date" className="form-input" name="endDate" value={formData.endDate} onChange={handleChange} style={{ height: '30px', fontSize: '11px' }} />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '4px', fontSize: '12px', fontWeight: 700 }}>
              <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} />
              Active Promotion
            </label>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '10px', padding: '10px', width: '100%', fontSize: '13px', fontWeight: 800 }}>
              <Save size={16} /> {editingId ? 'Update Promotion' : 'Save Promotion'}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: PROMOTIONS DATA TABLE */}
        <div className="glass-panel" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="desktop-section-title" style={{ margin: 0 }}>Active & Configured Offers ({offers.length})</div>
          </div>

          <div className="w-full overflow-x-auto overflow-y-auto max-h-[500px] border border-gray-200 rounded-lg shadow-sm flex-1">
            <table className="data-table" style={{ width: '100%', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th className="min-w-[150px]" style={{ padding: '8px 12px' }}>Offer Name</th>
                  <th className="min-w-[130px]" style={{ padding: '8px 12px' }}>Type</th>
                  <th className="min-w-[140px]" style={{ padding: '8px 12px' }}>Target</th>
                  <th className="min-w-[100px]" style={{ padding: '8px 12px', textAlign: 'center' }}>Min Qty</th>
                  <th className="min-w-[120px]" style={{ padding: '8px 12px', textAlign: 'right' }}>Reward</th>
                  <th className="min-w-[160px]" style={{ padding: '8px 12px', textAlign: 'center' }}>Valid Range</th>
                  <th className="min-w-[100px]" style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                  <th className="min-w-[90px]" style={{ padding: '8px 12px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
              {offers.map(offer => {
                const isExpired = offer.isExpired;
                const statusBg = isExpired ? '#f1f5f9' : (offer.isActive ? '#dcfce7' : '#fee2e2');
                const statusColor = isExpired ? '#64748b' : (offer.isActive ? '#15803d' : '#b91c1c');

                return (
                  <tr key={offer.id}>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{offer.offerName}</td>
                    <td style={{ color: '#475569', fontSize: '11px', fontWeight: 600 }}>
                      {offer.offerType === 'PERCENTAGE_DISCOUNT' ? '% Discount' : offer.offerType === 'CASH_DISCOUNT' ? 'Cash Disc' : offer.offerType === 'BUY_X_GET_Y' ? 'BOGO (Buy X Get Y)' : 'Min Qty Disc'}
                    </td>
                    <td style={{ color: '#0284c7', fontWeight: 600 }}>{offer.targetName || 'All Products'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{offer.conditionValue}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      {offer.offerType === 'PERCENTAGE_DISCOUNT' 
                        ? `${offer.rewardValue}%` 
                        : offer.offerType === 'BUY_X_GET_Y' 
                        ? `+${offer.rewardValue} Free` 
                        : `Rs. ${offer.rewardValue}`}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
                      {new Date(offer.startDate).toLocaleDateString()} - {new Date(offer.endDate).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '100px',
                        fontWeight: 700, fontSize: '10px', background: statusBg, color: statusColor
                      }}>
                        {offer.statusLabel || (isExpired ? 'Expired' : (offer.isActive ? 'Active' : 'Inactive'))}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button onClick={() => handleEdit(offer)} style={{ color: '#0284c7', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(offer.id)} style={{ color: '#ef4444', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {offers.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '30px', opacity: 0.5 }}>No promotions configured</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
};

export default PromotionsControl;
