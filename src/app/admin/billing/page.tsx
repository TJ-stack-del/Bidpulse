import React from 'react';

export default function BillingAdminPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900 relative">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Stripe Tiers Configuration
        </h1>
        <p className="text-sm text-slate-600 mt-2">
          Manage product pricing schemas and real-time tier allocations.
        </p>
      </header>
      
      <main className="grid grid-cols-1 gap-8 opacity-40 pointer-events-none">
        {/* Tier Configuration Layout */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Active Pricing Tiers</h2>
            <button className="min-h-[50px] min-w-[50px] px-4 py-2 bg-indigo-700 text-white rounded-md font-medium text-sm">
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
                    <button className="min-h-[50px] min-w-[50px] inline-flex items-center justify-center p-2 text-slate-900 border border-slate-300 rounded-md font-medium">
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
                    <button className="min-h-[50px] min-w-[50px] inline-flex items-center justify-center px-3 py-1 text-xs font-bold bg-slate-200 text-slate-900 rounded border border-slate-400">
                      Retry
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Delinquency Gating Blocker Backdrop & Modal */}
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl border-2 border-rose-500 max-w-md w-full p-6 shadow-2xl" role="dialog" aria-modal="true">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-3 w-3 rounded-full bg-rose-600 animate-pulse" />
            <h2 className="text-xl font-bold text-slate-900">
              Billing Verification Required
            </h2>
          </div>
          
          <p className="text-sm text-slate-700 leading-relaxed mb-6 font-medium">
            Access to administrative capabilities is temporarily locked. Your account status is marked as <span className="bg-rose-100 text-rose-950 font-bold px-1.5 py-0.5 rounded border border-rose-300">delinquent</span> due to a past-due webhook event balance.
          </p>

          <div className="flex flex-col gap-3">
            <button className="min-h-[50px] min-w-[50px] w-full px-4 py-2 bg-rose-700 text-white rounded-md font-bold hover:bg-rose-800 transition-colors focus:ring-2 focus:ring-rose-500 text-sm tracking-wide">
              Update Payment Method
            </button>
            <button className="min-h-[50px] min-w-[50px] w-full px-4 py-2 bg-slate-100 text-slate-900 border border-slate-300 rounded-md font-bold hover:bg-slate-200 transition-colors text-sm">
              Contact Enterprise Billing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
