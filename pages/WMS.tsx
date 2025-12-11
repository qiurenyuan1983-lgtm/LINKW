
import React, { useState } from 'react';
import {
  Package,
  Truck,
  ExternalLink,
  Database,
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  CheckCircle,
  Clock,
  MapPin,
  Calendar,
  X
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { LocationRule } from '../types';

// --- Native WMS Types ---
interface Product {
    sku: string;
    name: string;
    category: string;
    uom: string; // Unit of Measure
    weight: number;
}

interface InboundOrder {
    id: string;
    refNo: string;
    supplier: string;
    eta: string;
    status: 'pending' | 'received' | 'processing';
    items: { sku: string; qty: number }[];
}

interface OutboundOrder {
    id: string;
    orderNo: string;
    customer: string;
    deadline: string;
    status: 'open' | 'picked' | 'shipped';
    items: { sku: string; qty: number }[];
}

// --- Mock Initial Data for Demo ---
const MOCK_PRODUCTS: Product[] = [
    { sku: 'SKU-001', name: 'Wireless Mouse', category: 'Electronics', uom: 'PCS', weight: 0.2 },
    { sku: 'SKU-002', name: 'Mechanical Keyboard', category: 'Electronics', uom: 'PCS', weight: 1.5 },
    { sku: 'SKU-003', name: 'Office Chair', category: 'Furniture', uom: 'PCS', weight: 15.0 },
    { sku: 'SKU-004', name: 'Monitor Stand', category: 'Furniture', uom: 'PCS', weight: 2.0 },
];

const MOCK_INBOUND: InboundOrder[] = [
    { id: 'IB-1001', refNo: 'PO-2024-001', supplier: 'Tech Supplies Inc.', eta: '2024-06-15', status: 'pending', items: [{ sku: 'SKU-001', qty: 500 }] },
    { id: 'IB-1002', refNo: 'PO-2024-002', supplier: 'FurniWorld', eta: '2024-06-10', status: 'received', items: [{ sku: 'SKU-003', qty: 50 }] },
];

const MOCK_OUTBOUND: OutboundOrder[] = [
    { id: 'OB-5001', orderNo: 'SO-9988', customer: 'Amazon FBA', deadline: '2024-06-20', status: 'open', items: [{ sku: 'SKU-002', qty: 100 }] },
    { id: 'OB-5002', orderNo: 'SO-9989', customer: 'Walmart', deadline: '2024-06-18', status: 'shipped', items: [{ sku: 'SKU-001', qty: 200 }] },
];

interface Props {
    rules?: LocationRule[]; // Optional for now, but passed from App
    addLog?: (text: string) => void;
}

const WMS: React.FC<Props> = ({ rules = [], addLog }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'inventory' | 'inbound' | 'outbound' | 'master'>('inventory');
  
  // Local State for "Native" Operation
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [inbound, setInbound] = useState<InboundOrder[]>(MOCK_INBOUND);
  const [outbound, setOutbound] = useState<OutboundOrder[]>(MOCK_OUTBOUND);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'inbound' | 'outbound' | 'product' | null>(null);
  const [newOrderForm, setNewOrderForm] = useState<any>({}); // Simplified form state

  // Tabs Configuration
  const tabs = [
    { id: 'inventory', label: t('tabInventory'), icon: Package },
    { id: 'inbound', label: t('tabInbound'), icon: Truck },
    { id: 'outbound', label: t('tabOutbound'), icon: ExternalLink },
    { id: 'master', label: t('tabMaster'), icon: Database },
  ];

  // Helpers
  const getStatusColor = (status: string) => {
      switch(status) {
          case 'received': case 'shipped': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          case 'pending': case 'open': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'processing': case 'picked': return 'bg-orange-100 text-orange-700 border-orange-200';
          default: return 'bg-slate-100 text-slate-700 border-slate-200';
      }
  };

  const handleAdd = (type: 'inbound' | 'outbound' | 'product') => {
      setModalType(type);
      setNewOrderForm({});
      setShowModal(true);
  };

  const handleSave = () => {
      if (modalType === 'inbound') {
          const newOrder: InboundOrder = {
              id: `IB-${Date.now().toString().slice(-4)}`,
              refNo: newOrderForm.refNo || 'REF-NEW',
              supplier: newOrderForm.supplier || 'Unknown Supplier',
              eta: newOrderForm.date || new Date().toISOString().split('T')[0],
              status: 'pending',
              items: []
          };
          setInbound([newOrder, ...inbound]);
          if(addLog) addLog(`Created Inbound Order ${newOrder.id}`);
      } else if (modalType === 'outbound') {
          const newOrder: OutboundOrder = {
              id: `OB-${Date.now().toString().slice(-4)}`,
              orderNo: newOrderForm.orderNo || 'SO-NEW',
              customer: newOrderForm.customer || 'Unknown Customer',
              deadline: newOrderForm.date || new Date().toISOString().split('T')[0],
              status: 'open',
              items: []
          };
          setOutbound([newOrder, ...outbound]);
          if(addLog) addLog(`Created Outbound Order ${newOrder.id}`);
      } else if (modalType === 'product') {
          const newProd: Product = {
              sku: newOrderForm.sku || `SKU-${Date.now()}`,
              name: newOrderForm.name || 'New Product',
              category: newOrderForm.category || 'General',
              uom: 'PCS',
              weight: 0
          };
          setProducts([...products, newProd]);
      }
      setShowModal(false);
  };

  // --- Sub-Components ---

  const InventoryView = () => {
      // Aggregate inventory from Rules (passed props)
      const inventoryItems = rules.filter(r => (r.curPallet || 0) > 0);
      const filtered = inventoryItems.filter(r => r.range.includes(searchTerm.toUpperCase()) || r.destinations?.includes(searchTerm));

      return (
          <div className="space-y-4 animate-fade-in-up">
              <div className="flex justify-between items-center">
                  <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" 
                        placeholder={t('searchPlaceholder')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <div className="flex gap-2">
                      <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
                          Total Pallets: <span className="font-bold">{rules.reduce((acc, r) => acc + (r.curPallet || 0), 0)}</span>
                      </div>
                  </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-500 font-medium">
                          <tr>
                              <th className="px-4 py-3">Location</th>
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3 text-right">Pallets</th>
                              <th className="px-4 py-3 text-right">Cartons</th>
                              <th className="px-4 py-3">Destinations</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filtered.length > 0 ? filtered.map(r => (
                              <tr key={r.range} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 font-mono font-bold text-slate-700">{r.range}</td>
                                  <td className="px-4 py-3">
                                      <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 border border-slate-200">{r.type}</span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium">{r.curPallet}</td>
                                  <td className="px-4 py-3 text-right text-slate-500">{r.curCartons}</td>
                                  <td className="px-4 py-3">
                                      <div className="flex flex-wrap gap-1">
                                          {(r.destinations || '').split(/[,，]/).filter(Boolean).map((d, i) => (
                                              <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100">{d}</span>
                                          ))}
                                      </div>
                                  </td>
                              </tr>
                          )) : (
                              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No inventory found matching filter.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const InboundView = () => (
      <div className="space-y-4 animate-fade-in-up">
          <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-700">Receipt Notes (ASN)</h3>
              <button onClick={() => handleAdd('inbound')} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                  <Plus size={16} /> Create Receipt
              </button>
          </div>
          <div className="grid gap-3">
              {inbound.map(order => (
                  <div key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
                      <div>
                          <div className="flex items-center gap-3 mb-1">
                              <span className="font-bold text-slate-800">{order.refNo}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border capitalize ${getStatusColor(order.status)}`}>{order.status}</span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-4">
                              <span className="flex items-center gap-1"><Truck size={12} /> {order.supplier}</span>
                              <span className="flex items-center gap-1"><Calendar size={12} /> ETA: {order.eta}</span>
                          </div>
                      </div>
                      <div className="text-right">
                          <div className="text-sm font-medium">{order.items.length} Lines</div>
                          <button className="text-xs text-blue-600 hover:underline mt-1">View Details</button>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  const OutboundView = () => (
      <div className="space-y-4 animate-fade-in-up">
          <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-700">Shipment Orders</h3>
              <button onClick={() => handleAdd('outbound')} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                  <Plus size={16} /> Create Order
              </button>
          </div>
          <div className="grid gap-3">
              {outbound.map(order => (
                  <div key={order.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
                      <div>
                          <div className="flex items-center gap-3 mb-1">
                              <span className="font-bold text-slate-800">{order.orderNo}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border capitalize ${getStatusColor(order.status)}`}>{order.status}</span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-4">
                              <span className="flex items-center gap-1"><MapPin size={12} /> {order.customer}</span>
                              <span className="flex items-center gap-1"><Clock size={12} /> Due: {order.deadline}</span>
                          </div>
                      </div>
                      <div className="text-right">
                          <div className="text-sm font-medium">{order.items.length} Lines</div>
                          <button className="text-xs text-blue-600 hover:underline mt-1">View Details</button>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );

  const MasterDataView = () => (
      <div className="space-y-4 animate-fade-in-up">
          <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-700">Product List</h3>
              <button onClick={() => handleAdd('product')} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                  <Plus size={16} /> Add Product
              </button>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                          <th className="px-4 py-3">SKU</th>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 text-right">Weight (kg)</th>
                          <th className="px-4 py-3">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {products.map(p => (
                          <tr key={p.sku} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-mono text-slate-700">{p.sku}</td>
                              <td className="px-4 py-3 font-medium">{p.name}</td>
                              <td className="px-4 py-3"><span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{p.category}</span></td>
                              <td className="px-4 py-3 text-right">{p.weight}</td>
                              <td className="px-4 py-3">
                                  <button className="text-blue-600 hover:text-blue-800"><MoreHorizontal size={16} /></button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full space-y-4 relative">
        {/* Header Tabs */}
        <div className="flex overflow-x-auto pb-2 border-b border-slate-200 gap-2">
            {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                            isActive 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                        }`}
                    >
                        <Icon size={16} />
                        {tab.label}
                    </button>
                );
            })}
        </div>

        {/* Content */}
        <div className="flex-1">
            {activeTab === 'inventory' && <InventoryView />}
            {activeTab === 'inbound' && <InboundView />}
            {activeTab === 'outbound' && <OutboundView />}
            {activeTab === 'master' && <MasterDataView />}
        </div>

        {/* Add Modal */}
        {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                <div className="bg-white rounded-xl shadow-2xl w-[400px] max-w-[95%]" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 capitalize">Add {modalType}</h3>
                        <button onClick={() => setShowModal(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                    </div>
                    <div className="p-4 space-y-3">
                        {modalType === 'inbound' && (
                            <>
                                <input className="w-full border rounded p-2 text-sm" placeholder="PO Number (Ref)" onChange={e => setNewOrderForm({...newOrderForm, refNo: e.target.value})} />
                                <input className="w-full border rounded p-2 text-sm" placeholder="Supplier" onChange={e => setNewOrderForm({...newOrderForm, supplier: e.target.value})} />
                                <input type="date" className="w-full border rounded p-2 text-sm" onChange={e => setNewOrderForm({...newOrderForm, date: e.target.value})} />
                            </>
                        )}
                        {modalType === 'outbound' && (
                            <>
                                <input className="w-full border rounded p-2 text-sm" placeholder="Order Number" onChange={e => setNewOrderForm({...newOrderForm, orderNo: e.target.value})} />
                                <input className="w-full border rounded p-2 text-sm" placeholder="Customer" onChange={e => setNewOrderForm({...newOrderForm, customer: e.target.value})} />
                                <input type="date" className="w-full border rounded p-2 text-sm" onChange={e => setNewOrderForm({...newOrderForm, date: e.target.value})} />
                            </>
                        )}
                        {modalType === 'product' && (
                            <>
                                <input className="w-full border rounded p-2 text-sm" placeholder="SKU" onChange={e => setNewOrderForm({...newOrderForm, sku: e.target.value})} />
                                <input className="w-full border rounded p-2 text-sm" placeholder="Name" onChange={e => setNewOrderForm({...newOrderForm, name: e.target.value})} />
                                <input className="w-full border rounded p-2 text-sm" placeholder="Category" onChange={e => setNewOrderForm({...newOrderForm, category: e.target.value})} />
                            </>
                        )}
                        <button onClick={handleSave} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 mt-2">Save</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default WMS;
