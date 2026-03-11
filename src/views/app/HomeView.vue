<template>
  <!-- Skeleton loading — matches real layout so there's no jarring shift -->
  <div v-if="loading" class="space-y-4 p-4">
    <!-- Header stats skeleton -->
    <div class="grid grid-cols-3 gap-3">
      <div v-for="i in 3" :key="i" class="card bg-base-100 shadow p-4 space-y-2">
        <div class="skeleton h-3 w-20 rounded"></div>
        <div class="skeleton h-7 w-28 rounded"></div>
        <div class="skeleton h-3 w-16 rounded"></div>
      </div>
    </div>
    <!-- Chart skeleton -->
    <div class="card bg-base-100 shadow p-4 space-y-3">
      <div class="skeleton h-4 w-32 rounded"></div>
      <div class="skeleton h-48 w-full rounded"></div>
    </div>
    <!-- Holdings skeleton -->
    <div class="card bg-base-100 shadow p-4 space-y-3">
      <div class="skeleton h-4 w-24 rounded"></div>
      <div v-for="i in 4" :key="i" class="flex justify-between items-center py-2 border-b border-base-200">
        <div class="space-y-1">
          <div class="skeleton h-4 w-14 rounded"></div>
          <div class="skeleton h-3 w-20 rounded"></div>
        </div>
        <div class="skeleton h-4 w-16 rounded"></div>
      </div>
    </div>
  </div>

  <!-- Independent user: no portfolio yet -->
  <div v-else-if="!membership && !portfolioStore.portfolio" class="flex flex-col items-center justify-center py-20 space-y-4">
    <div class="text-6xl">&#128200;</div>
    <h2 class="text-2xl font-bold">Welcome to Beat the S&P 500!</h2>
    <p class="text-base-content/60 text-center max-w-md">Start with $100,000 in virtual cash and see if you can beat the market. Or join a class to compete with classmates.</p>
    <div class="flex gap-3">
      <button class="btn btn-primary" @click="handleStartInvesting" :disabled="creatingPortfolio">
        <span v-if="creatingPortfolio" class="loading loading-spinner loading-sm"></span>
        Start Investing
      </button>
      <RouterLink to="/join" class="btn btn-outline">Join a Class</RouterLink>
    </div>
  </div>

  <!-- Waiting for group assignment (teacher_assign mode) -->
  <div v-else-if="membership && !membership.group_id" class="flex flex-col items-center justify-center py-20 space-y-4">
    <div class="text-6xl">&#9203;</div>
    <h2 class="text-2xl font-bold">Waiting for Group Assignment</h2>
    <p class="text-base-content/60 text-center max-w-md">Your teacher hasn't assigned you to a group yet. Check back soon or explore the stocks page in the meantime!</p>
    <RouterLink to="/stocks" class="btn btn-primary">Browse Stocks</RouterLink>
  </div>

  <!-- Bonus Cash Notification Modal -->
  <dialog ref="bonusModal" class="modal" :class="{ 'modal-open': showBonusModal }">
    <div class="modal-box text-center">
      <div class="text-6xl mb-4">&#127881;</div>
      <h3 class="font-bold text-2xl mb-2">Congratulations!</h3>
      <p class="text-lg text-base-content/70 mb-4">Your team received a bonus of</p>
      <p class="text-4xl font-bold text-success mb-4">${{ bonusTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
      <p class="text-base-content/50 mb-6">from your teacher! Use it wisely.</p>
      <button class="btn btn-primary btn-block" @click="dismissBonus">Awesome!</button>
    </div>
    <form method="dialog" class="modal-backdrop" @click="dismissBonus"><button>close</button></form>
  </dialog>

  <div v-if="!loading && membership?.group_id" class="space-y-4">
    <!-- Level 1: Personal / Group tabs -->
    <div v-if="hasGroupPortfolio" class="flex gap-2">
      <button
        class="flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all"
        :class="activeTab === 'personal'
          ? 'bg-primary text-primary-content shadow'
          : 'bg-base-200 text-base-content/60 hover:bg-base-300'"
        @click="switchTab('personal')"
      >
        My Investments
      </button>
      <button
        class="flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all"
        :class="activeTab === 'group'
          ? 'bg-secondary text-secondary-content shadow'
          : 'bg-base-200 text-base-content/60 hover:bg-base-300'"
        @click="switchTab('group')"
      >
        {{ membership?.group?.name }}
      </button>
    </div>

    <!-- Level 2: Fund selector (group tab only) -->
    <div v-if="activeTab === 'group' && groupFunds.length > 0" class="flex items-center gap-2 overflow-x-auto pb-1">
      <button
        v-for="fund in groupFunds"
        :key="fund.id"
        class="btn btn-xs whitespace-nowrap"
        :class="activeFundId === fund.id ? 'btn-secondary' : 'btn-ghost'"
        @click="switchFund(fund)"
      >
        {{ fund.fund_name || `Fund ${fund.fund_number}` }}
      </button>
    </div>

    <!-- Loading spinner during tab switch -->
    <div v-if="switchingTab" class="flex justify-center py-10">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Header -->
    <div v-if="!switchingTab" class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold">
          <template v-if="activeTab === 'personal'">
            My Investments
            <span class="text-sm font-normal text-base-content/50">{{ auth.profile?.full_name }}</span>
          </template>
          <template v-else>
            {{ activeFundName }}
            <span class="text-sm font-normal text-base-content/50">{{ membership?.group?.name }}</span>
          </template>
        </h1>
        <select
          v-if="activeTab === 'personal'"
          v-model="personalVisibility"
          @change="handleVisibilityChange"
          class="select select-xs select-ghost"
        >
          <option value="private">Private</option>
          <option value="group">Group</option>
          <option value="public">Public</option>
        </select>
      </div>
      <RouterLink v-if="isIndependent" to="/join" class="btn btn-ghost btn-xs gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        Join a Class
      </RouterLink>
      <div v-if="activeTab === 'group'" class="flex flex-col gap-2">
        <div class="flex gap-1 flex-wrap">
          <div v-for="member in groupMembers" :key="member.id" class="badge badge-sm" :class="member.id === auth.currentUser?.id ? 'badge-primary' : 'badge-ghost'">
            <span v-if="member.avatar_url" class="avatar w-3 h-3 rounded-full mr-1"><img :src="member.avatar_url" /></span>
            {{ member.full_name?.split(' ')[0] }}
          </div>
        </div>
      </div>
    </div>

    <template v-if="!switchingTab">
    <!-- Group trading warning banner -->
    <div v-if="activeTab === 'group'" class="alert alert-warning py-2 px-3">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
      <span class="text-xs"><strong>Team Portfolio</strong> — Trades here affect all members of {{ membership?.group?.name }}. Coordinate with your team before buying or selling.</span>
    </div>

    <!-- Active Restrictions Card -->
    <div v-if="activeTab === 'group' && activeRestrictions" class="card bg-primary/5 border border-primary/20 shadow-sm">
      <div class="card-body p-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <h3 class="font-bold text-primary">Class Parameters & Restrictions</h3>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div v-if="activeRestrictions.universe === 'sp500'" class="flex items-start gap-2 text-sm">
            <span class="text-success mt-0.5">✔</span>
            <div>
              <span class="font-semibold">S&P 500 Universe</span>
              <p class="text-xs text-base-content/60">Only stocks in the S&P 500 (SPY) allowed.</p>
            </div>
          </div>
          <div v-if="activeRestrictions.maxStocksPerPortfolio" class="flex items-start gap-2 text-sm">
            <span class="text-info mt-0.5">ℹ</span>
            <div>
              <span class="font-semibold">Max {{ activeRestrictions.maxStocksPerPortfolio }} Stocks</span>
              <p class="text-xs text-base-content/60">Portfolio limited to {{ activeRestrictions.maxStocksPerPortfolio }} unique tickers.</p>
            </div>
          </div>
          <div v-if="activeRestrictions.minSectors" class="flex items-start gap-2 text-sm">
            <span class="text-info mt-0.5">ℹ</span>
            <div>
              <span class="font-semibold">Min {{ activeRestrictions.minSectors }} Sectors</span>
              <p class="text-xs text-base-content/60">Must diversify across at least {{ activeRestrictions.minSectors }} unique sectors.</p>
            </div>
          </div>
          <div v-if="activeRestrictions.requireDividends" class="flex items-start gap-2 text-sm">
            <span class="text-success mt-0.5">✔</span>
            <div>
              <span class="font-semibold">Dividend Mandate</span>
              <p class="text-xs text-base-content/60">All holdings must be dividend-paying stocks.</p>
            </div>
          </div>
          <div v-if="activeRestrictions.maxPositionPct" class="flex items-start gap-2 text-sm">
            <span class="text-info mt-0.5">ℹ</span>
            <div>
              <span class="font-semibold">Max Position Size: {{ activeRestrictions.maxPositionPct }}%</span>
              <p class="text-xs text-base-content/60">No single stock can exceed {{ activeRestrictions.maxPositionPct }}% of total value.</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- My Team (group tab only) -->
    <div v-if="activeTab === 'group' && membership?.group_id && groupMembers.length > 0" class="card bg-base-100 shadow">
      <div class="card-body p-3">
        <h3 class="font-semibold text-sm mb-3">👥 My Team</h3>
        <div class="flex flex-wrap gap-3">
          <div
            v-for="member in groupMembers"
            :key="member.id"
            class="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-2"
            :class="member.id === auth.currentUser?.id ? 'ring-1 ring-primary' : ''"
          >
            <div class="avatar placeholder">
              <div class="w-8 h-8 rounded-full" :class="member.id === auth.currentUser?.id ? 'bg-primary text-primary-content' : 'bg-neutral text-neutral-content'">
                <img v-if="member.avatar_url" :src="member.avatar_url" :alt="member.full_name" />
                <span v-else class="text-xs font-bold">{{ member.full_name?.charAt(0) }}</span>
              </div>
            </div>
            <div>
              <p class="text-xs font-semibold">{{ member.full_name?.split(' ')[0] }} <span v-if="member.id === auth.currentUser?.id" class="text-primary">(you)</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Two Key Stats -->
    <div class="grid grid-cols-2 gap-3">
      <div class="card bg-base-100 shadow">
        <div class="card-body p-3">
          <p class="text-xs text-base-content/60">Total Gain/Loss</p>
          <p class="text-xl font-bold" :class="portfolioStore.totalReturnDollar >= 0 ? 'text-success' : 'text-error'">
            {{ portfolioStore.totalReturnDollar >= 0 ? '+' : '-' }}${{ Math.abs(portfolioStore.totalReturnDollar).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}
          </p>
          <p class="text-xs" :class="portfolioStore.totalReturnPct >= 0 ? 'text-success' : 'text-error'">
            {{ portfolioStore.totalReturnPct >= 0 ? '+' : '' }}{{ portfolioStore.totalReturnPct.toFixed(2) }}%
          </p>
        </div>
      </div>
      <div class="card bg-base-100 shadow">
        <div class="card-body p-3">
          <p class="text-xs text-base-content/60">vs S&P 500 ({{ portfolioStore.benchmarkTicker }} proxy)</p>
          <p class="text-xl font-bold" :class="vsSP500 >= 0 ? 'text-success' : 'text-error'">
            {{ vsSP500 >= 0 ? '+' : '' }}{{ vsSP500.toFixed(2) }}%
          </p>
          <p class="text-xs text-base-content/50">
            {{ portfolioStore.isBeatingSP500 ? 'Beating the market' : 'Behind the market' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Portfolio Summary -->
    <div class="stats shadow bg-base-100 w-full">
      <div class="stat py-2">
        <div class="stat-title text-xs">Portfolio Value</div>
        <div class="stat-value text-lg">${{ portfolioStore.totalMarketValue.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</div>
      </div>
      <div class="stat py-2">
        <div class="stat-title text-xs">Cash Available</div>
        <div class="stat-value text-lg">${{ portfolioStore.cashBalance.toLocaleString('en-US', { maximumFractionDigits: 2 }) }}</div>
      </div>
      <div class="stat py-2">
        <div class="stat-title text-xs">S&P 500 (via {{ portfolioStore.benchmarkTicker }})</div>
        <div class="stat-value text-lg" :class="portfolioStore.benchmarkReturnPct >= 0 ? 'text-success' : 'text-error'">
          {{ portfolioStore.benchmarkReturnPct >= 0 ? '+' : '' }}{{ portfolioStore.benchmarkReturnPct.toFixed(2) }}%
        </div>
      </div>
    </div>

    <!-- Holdings -->
    <div class="card bg-base-100 shadow">
      <div class="card-body p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold">Holdings</h3>
          <button
            v-if="portfolioStore.holdings.length > 0"
            class="btn btn-error btn-outline btn-xs gap-1"
            @click="showSellAllModal = true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Sell All Positions
          </button>
        </div>
        <div v-if="portfolioStore.holdings.length === 0" class="text-base-content/50 text-center py-6 text-lg">
          No holdings yet. <RouterLink to="/stocks" class="link link-primary">Buy some stocks, ETFs, or other investments!</RouterLink>
        </div>
        <div class="overflow-x-auto" v-else>
          <table class="table table-sm table-zebra">
            <thead>
              <tr>
                <th>Stock</th>
                <th class="text-right">Shares</th>
                <th class="text-right">Price</th>
                <th class="text-right">Value</th>
                <th class="text-right">Gain/Loss</th>
                <th class="text-center">Quick Trade</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in portfolioStore.holdings" :key="h.ticker">
                <td>
                  <RouterLink :to="`/stocks/${h.ticker}`" class="flex items-center gap-2 group">
                    <div class="avatar">
                      <div class="w-8 h-8 rounded bg-base-200 flex items-center justify-center overflow-hidden border border-base-300">
                        <img v-if="h.image" :src="h.image" :alt="h.ticker" />
                        <span v-else class="text-[10px] font-bold text-base-content/40">{{ h.ticker }}</span>
                      </div>
                    </div>
                    <div>
                      <span class="font-mono font-bold group-hover:text-primary transition-colors">{{ h.ticker }}</span>
                      <span v-if="h.companyName" class="block text-[10px] leading-tight text-base-content/50 font-normal max-w-[120px] truncate">{{ h.companyName }}</span>
                    </div>
                  </RouterLink>
                </td>
                <td class="text-right font-mono text-xs">{{ Number(h.shares).toFixed(2) }}</td>
                <td class="text-right font-mono text-xs">${{ h.currentPrice.toFixed(2) }}</td>
                <td class="text-right font-mono text-xs font-semibold">${{ h.marketValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</td>
                <td class="text-right font-mono text-xs" :class="h.gainLoss >= 0 ? 'text-success' : 'text-error'">
                  {{ h.gainLoss >= 0 ? '+' : '' }}{{ h.gainLossPct.toFixed(2) }}%
                </td>
                <td class="text-center">
                  <div class="flex items-center justify-center gap-1">
                    <RouterLink :to="{ path: `/stocks/${h.ticker}`, query: { mode: 'buy' } }" class="btn btn-ghost btn-xs text-success px-1 hover:bg-success/10" title="Buy more">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
                    </RouterLink>
                    <RouterLink :to="{ path: `/stocks/${h.ticker}`, query: { mode: 'sell' } }" class="btn btn-ghost btn-xs text-error px-1 hover:bg-error/10" title="Sell shares">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
                    </RouterLink>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Sell All Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showSellAllModal }">
      <div class="modal-box max-w-lg border-t-4 border-error">
        <h3 class="font-bold text-xl flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          Confirm Sell All Positions
        </h3>
        <p class="py-4 text-base-content/70">
          You are about to liquidate all <strong>{{ portfolioStore.holdings.length }}</strong> positions in your {{ activeTab === 'personal' ? 'personal portfolio' : 'group fund' }}. This will convert all holdings back into cash.
        </p>
        
        <div class="bg-base-200 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
          <div v-for="h in portfolioStore.holdings" :key="h.ticker" class="flex justify-between items-center py-1 border-b border-base-300 last:border-0">
            <span class="font-mono font-bold">{{ h.ticker }}</span>
            <span class="text-sm font-mono text-base-content/60">{{ Number(h.shares).toFixed(2) }} shares ≈ ${{ h.marketValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</span>
          </div>
        </div>

        <div v-if="sellAllError" class="alert alert-error text-sm mb-4">
          <span>{{ sellAllError }}</span>
        </div>

        <div class="form-control mb-4">
          <label class="label py-1">
            <span class="label-text text-sm">Reason for liquidating (optional)</span>
          </label>
          <textarea
            v-model="sellAllRationale"
            class="textarea textarea-bordered w-full"
            rows="2"
            placeholder="e.g. Taking profits, market volatility, sector rotation..."
          ></textarea>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="showSellAllModal = false; sellAllRationale = ''; sellAllError = ''">Cancel</button>
          <button class="btn btn-error" @click="handleSellAll" :disabled="sellingAll">
            <span v-if="sellingAll" class="loading loading-spinner loading-sm"></span>
            Confirm Liquidation
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showSellAllModal = false"><button>close</button></form>
    </dialog>

    <!-- Portfolio Settings -->
    <div class="card bg-base-100 shadow" v-if="portfolioStore.portfolio">
      <div class="card-body p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold">Portfolio Settings</h3>
          <div class="flex items-center gap-2">
            <template v-if="activeTab === 'personal'">
            </template>
            <button class="btn btn-xs btn-ghost" @click="showSettings = !showSettings">
              {{ showSettings ? 'Hide' : 'Show' }}
            </button>
          </div>
        </div>
        <div v-if="showSettings" class="space-y-3">
          <!-- Name & Description -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="form-control">
              <label class="label py-1"><span class="label-text text-xs">Portfolio Name</span></label>
              <input v-model="settingsForm.name" type="text" class="input input-bordered input-sm" placeholder="My Portfolio" />
            </div>
            <div class="form-control">
              <label class="label py-1"><span class="label-text text-xs">Description</span></label>
              <input v-model="settingsForm.description" type="text" class="input input-bordered input-sm" placeholder="Growth strategy..." />
            </div>
          </div>

          <!-- Benchmark (locked to SPY) -->
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-xs">Benchmark Index</span></label>
            <div class="flex gap-2 items-center">
              <span class="input input-bordered input-sm flex-1 font-mono uppercase bg-base-200 flex items-center px-3 text-base-content/60">SPY</span>
              <span class="text-xs text-base-content/40">S&P 500 proxy (fixed)</span>
            </div>
          </div>

          <!-- Visibility -->
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-xs">Visibility</span></label>
            <select v-model="personalVisibility" @change="handleVisibilityChange" class="select select-bordered select-sm w-full max-w-xs">
              <option value="private">Private — only you can see it</option>
              <option value="group">Group — classmates see returns only</option>
              <option value="public">Public — anyone on platform sees returns</option>
            </select>
          </div>

          <!-- Save Name/Description -->
          <button class="btn btn-sm btn-primary" @click="saveMeta">Save Name & Description</button>

          <!-- Reset & Close (personal portfolios only) -->
          <div v-if="isPersonalPortfolio" class="divider text-xs text-base-content/40">Danger Zone</div>
          <div v-if="isPersonalPortfolio" class="flex flex-wrap items-center gap-2">
            <button class="btn btn-sm btn-error btn-outline" @click="showResetConfirm = true">Reset Portfolio</button>
            <button class="btn btn-sm btn-outline" @click="showCloseConfirm = true">Close Portfolio</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reset Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showResetConfirm }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">⚠️ Reset Portfolio?</h3>
        <p class="py-4 text-base-content/70">This will <strong>permanently clear all holdings</strong> and restore your cash to $100k. Your trade history is preserved but your current positions will be lost.</p>
        <div class="form-control mb-4">
          <label class="label"><span class="label-text text-sm">Type <strong>RESET</strong> to confirm</span></label>
          <input type="text" v-model="resetConfirmText" class="input input-bordered input-sm" placeholder="Type RESET here" />
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showResetConfirm = false; resetConfirmText = ''">Cancel</button>
          <button class="btn btn-error" @click="handleReset" :disabled="resetting || resetConfirmText !== 'RESET'">
            <span v-if="resetting" class="loading loading-spinner loading-sm"></span>
            Reset Portfolio
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showResetConfirm = false"><button>close</button></form>
    </dialog>

    <!-- Close Confirmation Modal -->
    <dialog class="modal" :class="{ 'modal-open': showCloseConfirm }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Close Portfolio?</h3>
        <p class="py-4 text-base-content/70">This will close your current portfolio and open a new one. Your track record stays visible in Portfolio History.</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="showCloseConfirm = false">Cancel</button>
          <button class="btn btn-error" @click="handleClose" :disabled="closing">
            <span v-if="closing" class="loading loading-spinner loading-sm"></span>
            Close & Start New
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showCloseConfirm = false"><button>close</button></form>
    </dialog>

    <!-- Settings Feedback -->
    <div v-if="settingsMsg" class="toast toast-end">
      <div class="alert" :class="settingsMsgType === 'success' ? 'alert-success' : 'alert-error'">
        <span>{{ settingsMsg }}</span>
      </div>
    </div>

    <!-- Queued Orders -->
    <div class="card bg-base-100 shadow" v-if="portfolioStore.pendingOrders.length > 0">
      <div class="card-body p-4">
        <h3 class="font-semibold mb-2">Queued Orders</h3>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Ticker</th>
                <th>Side</th>
                <th>Status</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in portfolioStore.pendingOrders.slice(0, 10)" :key="order.id" class="hover">
                <td class="text-[10px] text-base-content/50">{{ new Date(order.requested_at).toLocaleString() }}</td>
                <td class="font-mono font-bold text-xs">{{ order.ticker }}</td>
                <td><span class="badge badge-xs font-bold" :class="order.side === 'buy' ? 'badge-success' : 'badge-error'">{{ order.side.toUpperCase() }}</span></td>
                <td>
                  <span class="badge badge-xs" :class="order.status === 'failed' ? 'badge-error' : order.status === 'processing' ? 'badge-info' : 'badge-warning'">
                    {{ order.status.toUpperCase() }}
                  </span>
                  <span v-if="order.execute_after" class="block text-[10px] text-base-content/50 mt-1">Next try: {{ new Date(order.execute_after).toLocaleString() }}</span>
                  <span v-if="order.error_message" class="block text-[10px] text-error mt-1">{{ order.error_message }}</span>
                </td>
                <td class="text-right font-mono text-xs font-semibold">${{ Number(order.dollars).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Recent Trades -->
    <div class="card bg-base-100 shadow" v-if="portfolioStore.trades.length > 0">
      <div class="card-body p-4">
        <h3 class="font-semibold mb-2">Recent Trades</h3>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ticker</th>
                <th>Side</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="t in portfolioStore.trades.slice(0, 10)" :key="t.id">
                <tr class="hover">
                  <td class="text-[10px] text-base-content/50">{{ new Date(t.executed_at).toLocaleDateString() }}</td>
                  <td>
                    <RouterLink :to="`/stocks/${t.ticker}`" class="flex items-center gap-2 group">
                      <div class="avatar">
                        <div class="w-6 h-6 rounded bg-base-200 flex items-center justify-center overflow-hidden border border-base-300">
                          <img v-if="market.profilesCache[t.ticker]?.data?.image" :src="market.profilesCache[t.ticker].data.image" :alt="t.ticker" />
                          <span v-else class="text-[8px] font-bold text-base-content/40">{{ t.ticker }}</span>
                        </div>
                      </div>
                      <div>
                        <span class="font-mono font-bold text-xs group-hover:text-primary transition-colors">{{ t.ticker }}</span>
                        <span class="block text-[10px] text-base-content/40">{{ market.profilesCache[t.ticker]?.data?.companyName || '' }}</span>
                      </div>
                    </RouterLink>
                  </td>
                  <td><span class="badge badge-xs font-bold" :class="t.side === 'buy' ? 'badge-success' : 'badge-error'">{{ t.side.toUpperCase() }}</span></td>
                  <td class="text-right font-mono text-xs font-semibold">${{ Number(t.dollars).toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</td>
                  <td class="text-right font-mono text-xs text-base-content/60">${{ Number(t.price).toFixed(2) }}</td>
                </tr>
                <tr v-if="t.rationale">
                  <td colspan="5" class="pt-0 pb-3 pl-10">
                    <div class="bg-base-200/50 rounded p-1.5 border-l-2 border-primary/20">
                      <p class="text-[10px] italic text-base-content/60">"{{ t.rationale }}"</p>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div v-if="portfolioStore.holdings.length > 0 || portfolioStore.cashBalance > 0 || portfolioStore.trades.length > 0" class="space-y-4">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-3">
          <h3 class="font-semibold text-sm">Charts</h3>
          <RouterLink :to="{ path: '/attribution', query: portfolioStore.portfolio?.id ? { portfolioId: portfolioStore.portfolio.id } : {} }" class="btn btn-xs btn-primary gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Performance Attribution
          </RouterLink>
        </div>
        <TimeRangeSelector v-model="chartTimeRange" />
      </div>

      <div v-if="chartsLoading" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md"></span>
      </div>

      <template v-else>
        <!-- Two side-by-side line charts: Portfolio Value + Relative to SPY -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="card bg-base-100 shadow">
            <div class="card-body p-3">
              <h3 class="font-semibold text-sm mb-2">Portfolio Value</h3>
              <PortfolioLineChart
                v-if="portfolioValueDatasets.length > 0"
                :datasets="portfolioValueDatasets"
                :time-range="chartTimeRange"
                height="200px"
              />
            </div>
          </div>
          <div class="card bg-base-100 shadow">
            <div class="card-body p-3">
              <h3 class="font-semibold text-sm mb-2">Relative to S&P 500 <span class="text-xs font-normal text-base-content/40">({{ portfolioStore.benchmarkTicker }} proxy)</span></h3>
              <PortfolioLineChart
                v-if="relativeToSpyDatasets.length > 0"
                :datasets="relativeToSpyDatasets"
                :time-range="chartTimeRange"
                :show-percentage="true"
                height="200px"
              />
            </div>
          </div>
        </div>

<!-- Compare Teams (only when student is in a class) -->
        <div v-if="activeTab === 'personal' && membership?.group_id && membership.group_id !== 'personal' && classGroups.length > 0" class="card bg-base-100 shadow">
          <div class="card-body p-3">
            <h3 class="font-semibold text-sm mb-2">Compare Teams</h3>
            <div class="flex flex-wrap gap-1 mb-2">
              <button
                v-for="g in classGroups"
                :key="g.id"
                class="btn btn-xs"
                :class="selectedGroupIds.includes(g.id)
                  ? (g.id === membership.group_id ? 'btn-primary' : 'btn-secondary')
                  : 'btn-ghost'"
                :disabled="g.id === membership.group_id"
                @click="toggleGroupComparison(g.id)"
              >
                {{ g.name }}
              </button>
            </div>
            <div v-if="loadingComparison" class="flex justify-center py-4">
              <span class="loading loading-spinner loading-sm"></span>
            </div>
            <PortfolioLineChart
              v-else-if="comparisonDatasets.length > 0"
              :datasets="comparisonDatasets"
              :time-range="chartTimeRange"
              :show-percentage="true"
              height="200px"
            />
          </div>
        </div>

        <!-- Performance Line Chart -->
        <div class="card bg-base-100 shadow">
          <div class="card-body p-4">
            <h3 class="font-semibold mb-2">Performance vs {{ portfolioStore.benchmarkTicker }}</h3>
            <PortfolioLineChart
              v-if="performanceDatasets.length > 0"
              :datasets="performanceDatasets"
              :time-range="chartTimeRange"
              :show-percentage="true"
            />
          </div>
        </div>

        <!-- 4 Pie Charts: Stock, Sector, Country, Asset Class -->
        <div class="grid grid-cols-2 gap-3">
          <PortfolioPieChart
            v-if="stockSegments.length > 0"
            :segments="stockSegments"
            title="By Stock"
          />
          <PortfolioPieChart
            v-if="sectorSegments.length > 0"
            :segments="sectorSegments"
            title="By Sector"
          />
          <PortfolioPieChart
            v-if="countrySegments.length > 0"
            :segments="countrySegments"
            title="By Country"
          />
          <PortfolioPieChart
            v-if="assetClassSegments.length > 0"
            :segments="assetClassSegments"
            title="By Asset Class"
          />
        </div>
      </template>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { usePortfolioStore } from '../../stores/portfolio'
import { useMarketDataStore } from '../../stores/marketData'
import { supabase } from '../../lib/supabase'
import { getHistoricalDaily, getBatchProfiles } from '../../services/fmpApi'
import PortfolioLineChart from '../../components/charts/PortfolioLineChart.vue'
import PortfolioPieChart from '../../components/charts/PortfolioPieChart.vue'
import TimeRangeSelector from '../../components/charts/TimeRangeSelector.vue'
import { isMarketOpen } from '../../utils/marketHours'

const route = useRoute()
const auth = useAuthStore()
const portfolioStore = usePortfolioStore()
const market = useMarketDataStore()

const loading = ref(true)
const creatingPortfolio = ref(false)
const membership = ref(null)
const groupMembers = ref([])
const activeTab = ref('personal') // default to personal portfolio
const switchingTab = ref(false)
// True when user is in a real class with a group (not independent/personal)
const hasGroupPortfolio = computed(() => membership.value?.group_id && membership.value.group_id !== 'personal')
const showBonusModal = ref(false)
const bonusTotal = ref(0)
const showSettings = ref(false)
const showResetConfirm = ref(false)
const resetConfirmText = ref('')
const showCloseConfirm = ref(false)
const personalVisibility = ref('private')

// Multi-fund state (group funds only — personal has exactly 1 portfolio)
const groupFunds = ref([])
const activeFundId = ref(null)

const activeFund = computed(() =>
  groupFunds.value.find(f => f.id === activeFundId.value) || null
)
const activeFundName = computed(() => {
  if (activeTab.value === 'personal') return auth.profile?.full_name || 'My Investments'
  const f = activeFund.value
  if (!f) return portfolioStore.portfolio?.fund_name || 'Group Fund'
  return f.fund_name || `Fund ${f.fund_number}`
})
const resetting = ref(false)
const closing = ref(false)
const isPersonalPortfolio = computed(() => {
  const p = portfolioStore.portfolio
  return p && p.owner_type === 'user'
})
const settingsMsg = ref('')
const settingsMsgType = ref('success')
const settingsForm = ref({ name: '', description: '' })

// Sell All state
const showSellAllModal = ref(false)
const sellingAll = ref(false)
const sellAllRationale = ref('')
const sellAllError = ref('')

async function handleSellAll() {
  sellAllError.value = ''
  sellingAll.value = true
  try {
    const res = await portfolioStore.sellAll(undefined, sellAllRationale.value)
    if (res.success) {
      showSellAllModal.value = false
      sellAllRationale.value = ''
      const queuedCount = (res.results || []).filter(r => r.queued).length
      if (queuedCount === res.results.length && queuedCount > 0) {
        showFeedback(`Queued ${queuedCount} sell orders for the next market open.`)
      } else if (queuedCount > 0) {
        showFeedback(`Executed ${res.results.length - queuedCount} sells and queued ${queuedCount} for the next market open.`)
      } else {
        showFeedback(`Successfully sold all ${res.results.length} positions.`)
      }
      // Refresh charts and data
      resetCharts()
      if (portfolioStore.holdings.length > 0 || portfolioStore.trades.length > 0) loadCharts()
    } else {
      sellAllError.value = res.error || 'Failed to liquidate positions'
    }
  } finally {
    sellingAll.value = false
  }
}

  const vsSP500 = computed(() => portfolioStore.totalReturnPct - portfolioStore.benchmarkReturnPct)
const isIndependent = computed(() => membership.value?.group_id === 'personal')

const activeRestrictions = computed(() => {
  if (activeTab.value !== 'group') return null
  const classRestrictions = membership.value?.class?.restrictions
  if (!classRestrictions) return null
  
  const fundNum = String(portfolioStore.portfolio?.fund_number || '1')
  // Use fund-specific overrides if they exist, otherwise use global defaults
  return classRestrictions.byFund?.[fundNum] || classRestrictions
})

// Charts state
const chartTimeRange = ref('3M')
const chartsLoading = ref(false)
const performanceDatasets = ref([])
const portfolioValueDatasets = ref([])
const relativeToSpyDatasets = ref([])
const sectorSegments = ref([])
const countrySegments = ref([])
const stockSegments = ref([])
const assetClassSegments = ref([])

// Compare Teams state
const classGroups = ref([])
const selectedGroupIds = ref([])
const comparisonDatasets = ref([])
const loadingComparison = ref(false)

// Synthetic history helper
function generateSyntheticHistory(startDate, endDate, startValue, endValue, seed) {
  const start = new Date(startDate)
  const end = new Date(endDate || new Date())
  const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
  const points = []
  let rng = seed ? parseInt(String(seed).replace(/-/g, '').slice(0, 8), 16) : 12345
  for (let i = 0; i <= Math.min(days, 180); i++) {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff
    const noise = ((rng >>> 0) / 0xffffffff - 0.5) * 0.003
    const t = i / Math.max(days, 1)
    const value = startValue + (endValue - startValue) * t + noise * startValue
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    points.push({ date, value })
  }
  return points
}

let refreshInterval = null

onMounted(async () => {
  // Get current membership (works for both normal users and masquerade via effectiveUserId)
  membership.value = await auth.getCurrentMembership()

  if (membership.value?.group_id) {
    // Parallel: load group members, personal portfolio, and group funds simultaneously
    const [, , gFunds] = await Promise.all([
      auth.getGroupMembers(membership.value.group_id).then(m => { groupMembers.value = m }),
      portfolioStore.loadPersonalPortfolio(),
      portfolioStore.loadGroupFunds(membership.value.group_id)
    ])
    groupFunds.value = gFunds

    // Default: load personal portfolio
    if (portfolioStore.portfolio) {
      activeTab.value = 'personal'
      personalVisibility.value = portfolioStore.portfolio.visibility || 'private'
    } else if (groupFunds.value.length > 0) {
      // No personal portfolio, load first group fund
      activeFundId.value = groupFunds.value[0].id
      await portfolioStore.loadPortfolioById(groupFunds.value[0].id)
      activeTab.value = 'group'
    } else {
      await portfolioStore.loadPortfolio('group', membership.value.group_id)
    }

    // Check for bonus notifications
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('group_id', membership.value.group_id)
      .not('seen_by', 'cs', `{${auth.currentUser.id}}`)

    if (notifications?.length > 0) {
      bonusTotal.value = notifications.reduce((sum, n) => sum + Number(n.amount), 0)
      showBonusModal.value = true
    }
  } else if (!membership.value) {
    // Independent user - check for personal portfolio
    await portfolioStore.loadPersonalPortfolio()
    if (portfolioStore.portfolio) {
      membership.value = { group_id: 'personal', group: { name: 'My Investments' } }
      groupMembers.value = [{ id: auth.currentUser.id, full_name: auth.profile?.full_name }]
      personalVisibility.value = portfolioStore.portfolio.visibility || 'private'
    }
  }

  // If ?fund=xxx query param, switch to that group fund
  const fundQueryId = route.query.fund
  if (fundQueryId) {
    const groupMatch = groupFunds.value.find(f => f.id === fundQueryId)
    if (groupMatch) {
      activeTab.value = 'group'
      activeFundId.value = fundQueryId
      await portfolioStore.loadPortfolioById(fundQueryId)
    }
  }

  // Populate settings form
  if (portfolioStore.portfolio) {
    settingsForm.value = {
      name: portfolioStore.portfolio.name || '',
      description: portfolioStore.portfolio.description || ''
    }
    personalVisibility.value = portfolioStore.portfolio.visibility || 'private'
  }

  loading.value = false

  // Load charts after portfolio data is ready
  if (portfolioStore.holdings.length > 0 || portfolioStore.trades.length > 0) {
    loadCharts()
  }

  // Load class groups for Compare Teams chart
  if (membership.value?.class_id) {
    loadClassGroups()
  }

// Prefetch leaderboard data in background (so it loads instantly when user navigates there)
setTimeout(async () => {
  try {
    await import('../../stores/portfolio')
    await import('../../lib/supabase')
    // warm up membership + group data silently
    await auth.getCurrentMembership()
  } catch (e) { /* silent */ }
}, 3000)

// Auto-refresh prices every 5 minutes (300,000ms)
// Only if market is open and tab is focused to save API calls
refreshInterval = setInterval(async () => {
  if (document.hidden) return
  if (!isMarketOpen()) return

  if (portfolioStore.holdings.length) {
    const tickers = portfolioStore.holdings.map(h => h.ticker)
    if (tickers.length) await market.fetchBatchQuotes(tickers)
  }
}, 300000)

})

async function loadCharts() {
  if (portfolioStore.holdings.length === 0 && portfolioStore.trades.length === 0) return
  chartsLoading.value = true
  try {
    // --- Performance Line Chart ---
    // Build portfolio value over time from trade history
    const trades = [...portfolioStore.trades].sort(
      (a, b) => new Date(a.executed_at) - new Date(b.executed_at)
    )
    const startCash = portfolioStore.startingCash

    // Compute running portfolio value at each trade date
    const portfolioHistory = []
    let runningCash = startCash
    const holdingsMap = {} // ticker -> shares

    // Add starting point
    if (trades.length > 0) {
      const firstDate = new Date(trades[0].executed_at)
      portfolioHistory.push({ date: firstDate, value: startCash })
    }

    for (const t of trades) {
      const date = new Date(t.executed_at)
      if (t.side === 'buy') {
        runningCash -= Number(t.dollars)
        holdingsMap[t.ticker] = (holdingsMap[t.ticker] || 0) + Number(t.shares)
      } else {
        runningCash += Number(t.dollars)
        holdingsMap[t.ticker] = (holdingsMap[t.ticker] || 0) - Number(t.shares)
      }
      // Estimate portfolio value at trade time using trade prices
      let holdingsValue = 0
      for (const [ticker, shares] of Object.entries(holdingsMap)) {
        if (shares <= 0) continue
        // Use the trade price as approximation for that date
        const price = t.ticker === ticker ? Number(t.price) : (portfolioStore.holdings.find(h => h.ticker === ticker)?.currentPrice || 0)
        holdingsValue += shares * price
      }
      portfolioHistory.push({ date, value: runningCash + holdingsValue })
    }

    // Add current value as last point
    if (portfolioHistory.length > 0) {
      portfolioHistory.push({ date: new Date(), value: portfolioStore.totalMarketValue })
    }

    // Fetch SPY historical prices
    const firstTradeDate = trades.length > 0
      ? new Date(trades[0].executed_at).toISOString().split('T')[0]
      : new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    let spyHistory = []
    try {
      const spyData = await getHistoricalDaily('SPY', firstTradeDate, today)
      // spyData is newest-first, reverse it
      spyHistory = [...spyData].reverse().map(d => ({
        date: new Date(d.date),
        value: d.close
      }))
    } catch (e) {
      console.warn('Failed to fetch SPY history:', e)
    }

    // Normalize SPY to same starting value as portfolio
    if (spyHistory.length > 0) {
      const spyBaseline = spyHistory[0].value
      spyHistory = spyHistory.map(d => ({
        date: d.date,
        value: (d.value / spyBaseline) * startCash
      }))
    }

    // --- Performance vs SPY chart (% return comparison) ---
    // Only show if we have enough portfolio data points to avoid misleading spikes
    const datasets = []
    if (portfolioHistory.length > 2 && spyHistory.length > 0) {
      // Resample portfolio history to SPY's daily grid for smooth comparison
      const portfolioSorted = [...portfolioHistory].sort((a, b) => a.date - b.date)
      const spySorted = [...spyHistory].sort((a, b) => a.date - b.date)

      function interpolatePortfolioValue(targetDate) {
        const t = targetDate.getTime()
        if (t <= portfolioSorted[0].date.getTime()) return portfolioSorted[0].value
        if (t >= portfolioSorted[portfolioSorted.length - 1].date.getTime()) return portfolioSorted[portfolioSorted.length - 1].value
        for (let i = 1; i < portfolioSorted.length; i++) {
          if (portfolioSorted[i].date.getTime() >= t) {
            const prev = portfolioSorted[i - 1]
            const next = portfolioSorted[i]
            const ratio = (t - prev.date.getTime()) / (next.date.getTime() - prev.date.getTime())
            return prev.value + ratio * (next.value - prev.value)
          }
        }
        return portfolioSorted[portfolioSorted.length - 1].value
      }

      // Build daily portfolio values aligned to SPY dates
      const dailyPortfolio = spySorted.map(sp => ({
        date: sp.date,
        value: interpolatePortfolioValue(sp.date)
      }))

      datasets.push({ label: 'My Investments', data: dailyPortfolio, color: 'primary' })
      datasets.push({ label: 'S&P 500', data: spySorted, color: 'sp500' })
    }
    performanceDatasets.value = datasets

    // --- Portfolio Value Line Chart (absolute $) ---
    const pvDatasets = []
    if (portfolioHistory.length > 1) {
      pvDatasets.push({ label: 'My Investments', data: portfolioHistory, color: 'primary' })
    } else {
      // Synthetic fallback
      const createdAt = portfolioStore.portfolio?.created_at
      const synth = generateSyntheticHistory(createdAt, null, startCash, portfolioStore.totalMarketValue, portfolioStore.portfolio?.id)
      pvDatasets.push({ label: 'My Investments', data: synth, color: 'primary' })
    }
    if (spyHistory.length > 0) {
      pvDatasets.push({ label: portfolioStore.benchmarkTicker, data: spyHistory, color: 'sp500' })
    }
    portfolioValueDatasets.value = pvDatasets

    // --- Relative to S&P 500 (spread %) ---
    // Interpolate SPY values at portfolio dates for accurate comparison
    if (spyHistory.length > 1 && portfolioHistory.length > 1) {
      const spySorted = [...spyHistory].sort((a, b) => a.date - b.date)

      function interpolateSpyValue(targetDate) {
        const t = targetDate.getTime()
        if (t <= spySorted[0].date.getTime()) return spySorted[0].value
        if (t >= spySorted[spySorted.length - 1].date.getTime()) return spySorted[spySorted.length - 1].value
        for (let i = 1; i < spySorted.length; i++) {
          if (spySorted[i].date.getTime() >= t) {
            const prev = spySorted[i - 1]
            const next = spySorted[i]
            const ratio = (t - prev.date.getTime()) / (next.date.getTime() - prev.date.getTime())
            return prev.value + ratio * (next.value - prev.value)
          }
        }
        return spySorted[spySorted.length - 1].value
      }

      const myBaseline = portfolioHistory[0].value
      const spyBaseline = interpolateSpyValue(portfolioHistory[0].date)
      const spreadData = portfolioHistory.map(p => {
        const spyVal = interpolateSpyValue(p.date)
        const myRet = ((p.value - myBaseline) / myBaseline) * 100
        const spyRet = spyBaseline > 0 ? ((spyVal - spyBaseline) / spyBaseline) * 100 : 0
        return { date: p.date, value: 100 + (myRet - spyRet) }
      })
      relativeToSpyDatasets.value = [{ label: 'vs S&P 500', data: spreadData, color: 'accent' }]
    }

    // --- Sector & Country Pie Charts ---
    const tickers = portfolioStore.holdings.map(h => h.ticker)
    let profiles = []
    try {
      profiles = await getBatchProfiles(tickers)
    } catch (e) {
      console.warn('Failed to fetch profiles for charts:', e)
    }

    const profileMap = {}
    for (const p of (profiles || [])) {
      profileMap[p.symbol] = p
    }

    // Build sector segments
    const sectorMap = {}
    const countryMap = {}
    for (const h of portfolioStore.holdings) {
      const profile = profileMap[h.ticker]
      const sector = profile?.sector || 'Unknown'
      const country = profile?.country || 'Unknown'
      sectorMap[sector] = (sectorMap[sector] || 0) + h.marketValue
      countryMap[country] = (countryMap[country] || 0) + h.marketValue
    }

    sectorSegments.value = Object.entries(sectorMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    countrySegments.value = Object.entries(countryMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)

    // --- By Stock Pie Chart ---
    stockSegments.value = portfolioStore.holdings
      .map(h => ({ label: h.ticker, value: h.marketValue }))
      .sort((a, b) => b.value - a.value)

    // --- By Asset Class Pie Chart ---
    const acMap = {}
    acMap['Cash'] = portfolioStore.cashBalance
    for (const h of portfolioStore.holdings) {
      acMap['Stock'] = (acMap['Stock'] || 0) + h.marketValue
    }
    assetClassSegments.value = Object.entries(acMap)
      .filter(([, v]) => v > 0)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
  } finally {
    chartsLoading.value = false
  }
}

// --- Compare Teams ---
const GROUP_COLORS = ['primary', 'secondary', 'accent', 'info', 'success', 'warning', 'error', 'neutral1', 'neutral2', 'neutral3']

async function loadClassGroups() {
  if (!membership.value?.class_id) return
  const { data } = await supabase
    .from('groups')
    .select('*, portfolios(id, cash_balance, starting_cash, created_at)')
    .eq('class_id', membership.value.class_id)
  if (!data) return
  classGroups.value = data
  // My group always selected
  selectedGroupIds.value = [membership.value.group_id]
  await buildComparisonDatasets()
}

function toggleGroupComparison(groupId) {
  if (groupId === membership.value.group_id) return // can't deselect own group
  const idx = selectedGroupIds.value.indexOf(groupId)
  if (idx >= 0) {
    selectedGroupIds.value.splice(idx, 1)
  } else {
    selectedGroupIds.value.push(groupId)
  }
  buildComparisonDatasets()
}

async function buildComparisonDatasets() {
  loadingComparison.value = true
  try {
    const datasets = []
    const startCash = portfolioStore.startingCash

    for (let gi = 0; gi < selectedGroupIds.value.length; gi++) {
      const gid = selectedGroupIds.value[gi]
      const group = classGroups.value.find(g => g.id === gid)
      if (!group) continue

      const portfolio = group.portfolios?.[0]
      if (!portfolio) continue

      const gStartCash = portfolio.starting_cash || startCash

      // Fetch current group portfolio value
      let currentValue = gStartCash
      if (gid === membership.value.group_id) {
        currentValue = portfolioStore.totalMarketValue
      } else {
        // Query holdings for this group's portfolio to estimate value
        const { data: holdings } = await supabase
          .from('holdings')
          .select('ticker, shares, avg_cost')
          .eq('portfolio_id', portfolio.id)

        let holdingsValue = 0
        if (holdings?.length > 0) {
          // Approximate using our cached prices if available
          for (const h of holdings) {
            const ourHolding = portfolioStore.holdings.find(oh => oh.ticker === h.ticker)
            const price = ourHolding?.currentPrice || h.avg_cost
            holdingsValue += Number(h.shares) * price
          }
        }
        currentValue = (portfolio.cash_balance || 0) + holdingsValue
      }

      const synth = generateSyntheticHistory(portfolio.created_at, null, gStartCash, currentValue, gid)
      const colorIdx = gi % GROUP_COLORS.length
      datasets.push({
        label: group.name,
        data: synth,
        color: GROUP_COLORS[colorIdx]
      })
    }

    // Add SPY line using real historical data if available
    const createdAt = portfolioStore.portfolio?.created_at
    if (createdAt) {
      const fromStr = new Date(createdAt).toISOString().split('T')[0]
      const toStr = new Date().toISOString().split('T')[0]
      try {
        const spyData = await getHistoricalDaily('SPY', fromStr, toStr)
        if (Array.isArray(spyData) && spyData.length > 0) {
          const sorted = [...spyData].reverse()
          const spyBase = sorted[0].close
          const spyNormalized = sorted.map(d => ({
            date: new Date(d.date),
            value: (d.close / spyBase) * startCash
          }))
          datasets.push({ label: portfolioStore.benchmarkTicker, data: spyNormalized, color: 'sp500' })
        }
      } catch (e) { /* skip SPY line if fetch fails */ }
    }

    comparisonDatasets.value = datasets
  } finally {
    loadingComparison.value = false
  }
}

async function handleStartInvesting() {
  creatingPortfolio.value = true
  const result = await portfolioStore.createPersonalPortfolio()
  if (result.error) {
    creatingPortfolio.value = false
    return
  }
  await portfolioStore.loadPersonalPortfolio()
  membership.value = { group_id: 'personal', group: { name: 'My Investments' } }
  groupMembers.value = [{ id: auth.currentUser.id, full_name: auth.profile?.full_name }]
  personalVisibility.value = portfolioStore.portfolio?.visibility || 'private'
  settingsForm.value = {
    name: portfolioStore.portfolio?.name || '',
    description: portfolioStore.portfolio?.description || '',
    benchmark: portfolioStore.benchmarkTicker,
    isPublic: portfolioStore.portfolio?.is_public ?? true
  }
  creatingPortfolio.value = false
}

function showFeedback(msg, type = 'success') {
  settingsMsg.value = msg
  settingsMsgType.value = type
  setTimeout(() => { settingsMsg.value = '' }, 3000)
}

async function handleVisibilityChange() {
  const result = await portfolioStore.updateVisibility(portfolioStore.portfolio?.id, personalVisibility.value)
  if (result.error) return showFeedback(result.error, 'error')
  const labels = { private: 'Private', group: 'Group', public: 'Public' }
  showFeedback(`Visibility set to ${labels[personalVisibility.value]}`)
}

async function saveMeta() {
  const result = await portfolioStore.updatePortfolioMeta(
    settingsForm.value.name,
    settingsForm.value.description
  )
  if (result.error) return showFeedback(result.error, 'error')
  showFeedback('Portfolio info saved')
}

async function handleReset() {
  resetting.value = true
  const result = await portfolioStore.resetPortfolio()
  showResetConfirm.value = false
  resetConfirmText.value = ''
  resetting.value = false
  if (result.error) return showFeedback(result.error, 'error')
  showFeedback('Portfolio has been reset!')
}

async function handleClose() {
  closing.value = true
  const result = await portfolioStore.closePortfolio()
  showCloseConfirm.value = false
  closing.value = false
  if (result.error) return showFeedback(result.error, 'error')
  // Update settings form for the new portfolio
  if (portfolioStore.portfolio) {
    settingsForm.value = {
      name: portfolioStore.portfolio.name || '',
      description: portfolioStore.portfolio.description || ''
    }
  }
  // Switch to personal tab
  activeTab.value = 'personal'
  // Reload charts
  performanceDatasets.value = []
  sectorSegments.value = []
  countrySegments.value = []
  showFeedback('Portfolio closed. New portfolio created!')
}

async function switchFund(fund) {
  if (fund.id === activeFundId.value) return
  activeFundId.value = fund.id
  switchingTab.value = true
  try {
    await portfolioStore.loadPortfolioById(fund.id)
    if (portfolioStore.portfolio) {
      settingsForm.value = {
        name: portfolioStore.portfolio.name || '',
        description: portfolioStore.portfolio.description || ''
      }
    }
    resetCharts()
    if (portfolioStore.holdings.length > 0 || portfolioStore.trades.length > 0) {
      loadCharts()
    }
  } finally {
    switchingTab.value = false
  }
}

function resetCharts() {
  performanceDatasets.value = []
  portfolioValueDatasets.value = []
  relativeToSpyDatasets.value = []
  sectorSegments.value = []
  countrySegments.value = []
  stockSegments.value = []
  assetClassSegments.value = []
  comparisonDatasets.value = []
}

async function switchTab(tab) {
  if (tab === activeTab.value) return
  activeTab.value = tab
  switchingTab.value = true
  try {
    if (tab === 'personal') {
      await portfolioStore.loadPersonalPortfolio()
      personalVisibility.value = portfolioStore.portfolio?.visibility || 'private'
    } else {
      // Group tab: load first group fund
      if (groupFunds.value.length > 0) {
        activeFundId.value = groupFunds.value[0].id
        await portfolioStore.loadPortfolioById(groupFunds.value[0].id)
      } else {
        await portfolioStore.loadPortfolio('group', membership.value.group_id)
      }
    }
    // Update settings form for the new portfolio
    if (portfolioStore.portfolio) {
      settingsForm.value = {
        name: portfolioStore.portfolio.name || '',
        description: portfolioStore.portfolio.description || ''
      }
    }
    resetCharts()
    if (portfolioStore.holdings.length > 0 || portfolioStore.trades.length > 0) {
      loadCharts()
    }
  } finally {
    switchingTab.value = false
  }
}

async function dismissBonus() {
  showBonusModal.value = false
  if (membership.value?.group_id) {
    // Mark notifications as seen
    const { data: notifications } = await supabase
      .from('notifications')
      .select('id, seen_by')
      .eq('group_id', membership.value.group_id)

    for (const n of (notifications || [])) {
      const seenBy = n.seen_by || []
      if (!seenBy.includes(auth.currentUser.id)) {
        await supabase
          .from('notifications')
          .update({ seen_by: [...seenBy, auth.currentUser.id] })
          .eq('id', n.id)
      }
    }
  }
}
onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

</script>
