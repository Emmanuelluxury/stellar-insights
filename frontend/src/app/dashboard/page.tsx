"use client"

import React, { useEffect, useState, useCallback } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'

type Corridor = {
  id: string
  health: number
  successRate: number
}

type TopAsset = {
  asset: string
  volume: number
  tvl: number
}

type TimePoint = {
  ts: string
  successRate: number
  settlementMs: number
  tvl: number
}

type DashboardData = {
  totalSuccessRate: number
  activeCorridors: Corridor[]
  topAssets: TopAsset[]
  timeseries: TimePoint[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30_000) // refresh every 30s
    return () => clearInterval(id)
  }, [fetchData])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Network Dashboard</h1>
        <div className="flex gap-2 items-center">
          <button
            className="px-3 py-1 rounded bg-sky-600 text-white text-sm"
            onClick={() => fetchData()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded p-6 bg-gray-50">Loading metrics…</div>
      )}

      {error && (
        <div className="rounded p-4 bg-rose-50 text-rose-700">Error: {error}</div>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 bg-white rounded shadow p-4">
            <h2 className="text-sm text-gray-500">Total Payment Success Rate</h2>
            <div className="mt-3 flex items-end gap-4">
              <div className="text-4xl font-bold">
                {(data.totalSuccessRate * 100).toFixed(2)}%
              </div>
              <div className="text-sm text-gray-500">(last 24h)</div>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-2 bg-white rounded shadow p-4">
            <h2 className="text-sm text-gray-500">Settlement Speed (ms) — last 24 points</h2>
            <div style={{ width: '100%', height: 220 }} className="mt-3">
              <ResponsiveContainer>
                <LineChart data={data.timeseries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ts" tickFormatter={(s) => new Date(s).getHours() + ':00'} />
                  <YAxis />
                  <Tooltip labelFormatter={(s) => new Date(s).toLocaleString()} />
                  <Legend />
                  <Line type="monotone" dataKey="settlementMs" stroke="#8884d8" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-1 lg:col-span-2 bg-white rounded shadow p-4">
            <h2 className="text-sm text-gray-500">Liquidity Depth / TVL (24h)</h2>
            <div style={{ width: '100%', height: 240 }} className="mt-3">
              <ResponsiveContainer>
                <LineChart data={data.timeseries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ts" tickFormatter={(s) => new Date(s).getHours() + ':00'} />
                  <YAxis />
                  <Tooltip labelFormatter={(s) => new Date(s).toLocaleString()} />
                  <Legend />
                  <Line type="monotone" dataKey="tvl" stroke="#82ca9d" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-1 bg-white rounded shadow p-4">
            <h2 className="text-sm text-gray-500">Active Corridor Health</h2>
            <ul className="mt-3 space-y-3">
              {data.activeCorridors.map((c) => (
                <li key={c.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.id}</div>
                    <div className="text-sm text-gray-500">Success: {(c.successRate * 100).toFixed(2)}%</div>
                  </div>
                  <div className="text-sm font-semibold">
                    {(c.health * 100).toFixed(0)}%
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-1 lg:col-span-2 bg-white rounded shadow p-4">
            <h2 className="text-sm text-gray-500">Top-performing Assets</h2>
            <div className="mt-3 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="pb-2">Asset</th>
                    <th className="pb-2">Volume</th>
                    <th className="pb-2">TVL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topAssets.map((a) => (
                    <tr key={a.asset} className="border-t">
                      <td className="py-2 font-medium">{a.asset}</td>
                      <td className="py-2">{a.volume.toLocaleString()}</td>
                      <td className="py-2">${a.tvl.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
"use client";

import React, { useEffect, useState } from "react";
import { TrendingUp, BarChart3, Anchor, Activity, Loader } from "lucide-react";
import { MainLayout } from "@/components/layout";

interface StatCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  trend?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching dashboard stats
    setTimeout(() => {
      setStats([
        {
          title: "Active Corridors",
          value: "24",
          icon: <TrendingUp className="w-6 h-6" />,
          description: "Payment corridors",
          trend: "+3 this month",
        },
        {
          title: "Network Health",
          value: "98.5%",
          icon: <Activity className="w-6 h-6" />,
          description: "Overall success rate",
          trend: "+2.3% from last week",
        },
        {
          title: "Active Anchors",
          value: "156",
          icon: <Anchor className="w-6 h-6" />,
          description: "Liquidity providers",
          trend: "+12 this month",
        },
        {
          title: "Total Volume",
          value: "$2.4M",
          icon: <BarChart3 className="w-6 h-6" />,
          description: "24h transaction volume",
          trend: "+18% from yesterday",
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Overview of your Stellar payment network insights
          </p>
        </div>

        {/* Stats Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-blue-500 dark:text-blue-400">
                    {stat.icon}
                  </div>
                </div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {stat.title}
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {stat.description}
                </p>
                {stat.trend && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {stat.trend}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/corridors"
              className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                Explore Corridors
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                View payment corridors and their performance metrics
              </p>
            </a>
            <a
              href="/anchors"
              className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                Browse Anchors
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Discover liquidity providers and their details
              </p>
            </a>
            <a
              href="/analytics"
              className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                View Analytics
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Deep dive into network performance data
              </p>
            </a>
            <a
              href="/"
              className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                Return to Home
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Go back to the landing page
              </p>
            </a>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
