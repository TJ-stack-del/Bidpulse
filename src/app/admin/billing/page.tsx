import React from 'react';

export default function BillingAdminPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Stripe Tiers Configuration
        </h1>
        <p className="text-sm text-slate-600 mt-2">
          Manage product pricing schemas and real-time tier allocations.
        </p>
      </header>
      
      <main className="grid grid-cols-1 gap-8">
        {/* Tier Configuration Layout */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Active Pricing Tiers</h2>
            <button className="min-h-[50px] min-w-[50px] px-4 py-2 bg-indigo-700 text-white rounded-md font-medium hover:bg-indigo-800 transition-colors focus:ring-2 focus:ring-indigo-500 text-sm">
              Add Tier
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-slate-700">
              <thead className="bg-slate-100 uppercase text-xs font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Tier Name</th>
                  <th className="px-6 py-4">Monthly Rate</th>
                  <th className="px-6 py-4">Usage Limits</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-950">Standard Base</td>
                  <td className="px-6 py-4 text-slate-950 font-semibold">$29.00 / mo</td>
                  <td className="px-6 py-4 text-slate-700">Up to 10,000 requests</td>
                  <td className="px-6 py-4 text-right">
                    <button className="min-h-[50px] min-w-[50px] inline-flex items-center justify-center p-2 text-slate-900 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition-all font-medium border border-slate-300">
                      Edit
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Subscription Live Logs Stream */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Subscription Live Logs</h2>
            <p className="text-xs text-slate-600 mt-1">Real-time webhook events synced from Supabase storage.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 uppercase text-xs font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Event ID</th>
                  <th className="px-6 py-4">Status Flag</th>
                  <th className="px-6 py-4">Sync Indicators</th>
                  <th className="px-6 py-4 text-right">Retry Strategy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-xs text-slate-900 font-semibold">evt_1NfX2bLkd</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-950 border border-emerald-300">
                      active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium">Asynchronous processing complete</td>
                  <td className="px-6 py-4 text-right">
                    <button className="min-h-[50px] min-w-[50px] inline-flex items-center justify-center px-3 py-1 text-xs font-bold bg-slate-200 text-slate-900 rounded border border-slate-400 hover:bg-slate-300 transition-colors">
                      Retry
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-xs text-slate-900 font-semibold">evt_2MjZ5kPld</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-950 border border-amber-300">
                      past_due
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium">Retry protocol sequence initiated</td>
                  <td className="px-6 py-4 text-right">
                    <button className="min-h-[50px] min-w-[50px] inline-flex items-center justify-center px-3 py-1 text-xs font-bold bg-slate-200 text-slate-900 rounded border border-slate-400 hover:bg-slate-300 transition-colors">
                      Retry
                    </button>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-xs text-slate-900 font-semibold">evt_3KkW9qRst</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-950 border border-rose-300">
                      canceled
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium">Billing authorization revoked</td>
                  <td className="px-6 py-4 text-right">
                    <button className="min-h-[50px] min-w-[50px] inline-flex items-center justify-center px-3 py-1 text-xs font-bold bg-slate-200 text-slate-900 rounded border border-slate-400 hover:bg-slate-300 transition-colors">
                      Retry
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
