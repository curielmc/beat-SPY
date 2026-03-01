<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Stocks & Securities</h1>

    <!-- Search -->
    <input v-model="searchQuery" type="text" placeholder="Search by ticker or company name..." class="input input-bordered w-full" @input="handleSearch" />

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2">
      <!-- Type dropdown -->
      <div class="dropdown">
        <label tabindex="0" class="btn btn-sm btn-outline gap-1" :class="{ 'btn-primary': activeFilters.assetType }">
          Type
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </label>
        <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-52">
          <li v-for="t in assetTypeOptions" :key="t.label"><a @click="setFilter('assetType', t.label)" :class="{ 'active': activeFilters.assetType === t.label }">{{ t.label }}</a></li>
        </ul>
      </div>

      <!-- Sector dropdown -->
      <div class="dropdown">
        <label tabindex="0" class="btn btn-sm btn-outline gap-1" :class="{ 'btn-primary': activeFilters.sector }">
          Sector
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </label>
        <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-56 max-h-60 overflow-y-auto">
          <li v-for="s in sectorOptions" :key="s"><a @click="setFilter('sector', s)" :class="{ 'active': activeFilters.sector === s }">{{ s }}</a></li>
        </ul>
      </div>

      <!-- Size dropdown -->
      <div class="dropdown">
        <label tabindex="0" class="btn btn-sm btn-outline gap-1" :class="{ 'btn-primary': activeFilters.size }">
          Size
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </label>
        <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-52">
          <li v-for="s in sizeOptions" :key="s.label"><a @click="setFilter('size', s.label)" :class="{ 'active': activeFilters.size === s.label }">{{ s.label }}</a></li>
        </ul>
      </div>

      <!-- Style dropdown -->
      <div class="dropdown">
        <label tabindex="0" class="btn btn-sm btn-outline gap-1" :class="{ 'btn-primary': activeFilters.style }">
          Style
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </label>
        <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-52">
          <li v-for="s in styleOptions" :key="s.label"><a @click="setFilter('style', s.label)" :class="{ 'active': activeFilters.style === s.label }">{{ s.label }}</a></li>
        </ul>
      </div>

      <!-- Region dropdown -->
      <div class="dropdown">
        <label tabindex="0" class="btn btn-sm btn-outline gap-1" :class="{ 'btn-primary': activeFilters.region }">
          Region
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </label>
        <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-56">
          <li v-for="r in regionOptions" :key="r.label"><a @click="setFilter('region', r.label)" :class="{ 'active': activeFilters.region === r.label }">{{ r.label }}</a></li>
        </ul>
      </div>

      <!-- Risk Exposure dropdown -->
      <div class="dropdown">
        <label tabindex="0" class="btn btn-sm btn-outline gap-1" :class="{ 'btn-primary': activeFilters.riskExposure }">
          Risk Exposure
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
        </label>
        <ul tabindex="0" class="dropdown-content z-50 menu p-2 shadow bg-base-100 rounded-box w-52">
          <li v-for="r in riskExposureOptions" :key="r.label"><a @click="setFilter('riskExposure', r.label)" :class="{ 'active': activeFilters.riskExposure === r.label }">{{ r.label }}</a></li>
        </ul>
      </div>

      <button v-if="hasActiveFilters" class="btn btn-sm btn-ghost text-error" @click="clearFilters">Clear all</button>
    </div>

    <!-- Active filter badges -->
    <div v-if="hasActiveFilters" class="flex flex-wrap gap-2">
      <span v-if="activeFilters.sector" class="badge badge-primary gap-1">
        {{ activeFilters.sector }}
        <button class="btn btn-ghost btn-xs px-0" @click="removeFilter('sector')">&#10005;</button>
      </span>
      <span v-if="activeFilters.size" class="badge badge-primary gap-1">
        {{ activeFilters.size }}
        <button class="btn btn-ghost btn-xs px-0" @click="removeFilter('size')">&#10005;</button>
      </span>
      <span v-if="activeFilters.style" class="badge badge-primary gap-1">
        {{ activeFilters.style }}
        <button class="btn btn-ghost btn-xs px-0" @click="removeFilter('style')">&#10005;</button>
      </span>
      <span v-if="activeFilters.assetType" class="badge badge-primary gap-1">
        {{ activeFilters.assetType }}
        <button class="btn btn-ghost btn-xs px-0" @click="removeFilter('assetType')">&#10005;</button>
      </span>
      <span v-if="activeFilters.region" class="badge badge-primary gap-1">
        {{ activeFilters.region }}
        <button class="btn btn-ghost btn-xs px-0" @click="removeFilter('region')">&#10005;</button>
      </span>
      <span v-if="activeFilters.riskExposure" class="badge badge-primary gap-1">
        {{ activeFilters.riskExposure }}
        <button class="btn btn-ghost btn-xs px-0" @click="removeFilter('riskExposure')">&#10005;</button>
      </span>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <!-- Search Results (override filters when search is active) -->
    <div v-if="searchQuery && !loading" class="space-y-2">
      <RouterLink v-for="stock in displayStocks" :key="stock.symbol || stock.ticker" :to="`/stocks/${stock.symbol || stock.ticker}`" class="card bg-base-100 shadow hover:shadow-md transition-shadow cursor-pointer block">
        <div class="card-body p-4 flex-row justify-between items-center">
          <div>
            <p class="font-bold">{{ stock.symbol || stock.ticker }}</p>
            <p class="text-xs text-base-content/60">{{ stock.name }}</p>
            <span v-if="stock.exchangeShortName" class="badge badge-ghost badge-xs mt-1">{{ stock.exchangeShortName }}</span>
          </div>
          <div class="text-right" v-if="stock.price">
            <p class="font-semibold">${{ Number(stock.price).toFixed(2) }}</p>
            <p v-if="stock.changesPercentage != null" class="text-sm" :class="stock.changesPercentage >= 0 ? 'text-success' : 'text-error'">
              {{ stock.changesPercentage >= 0 ? '+' : '' }}{{ Number(stock.changesPercentage).toFixed(2) }}%
            </p>
          </div>
        </div>
      </RouterLink>
      <p v-if="displayStocks.length === 0" class="text-center text-base-content/50 py-8">No stocks match your search.</p>
    </div>

    <!-- Filtered Results -->
    <div v-if="!searchQuery && hasActiveFilters && !loading" class="space-y-2">
      <p class="text-sm text-base-content/60">{{ filteredStocks.length }} results</p>
      <RouterLink v-for="stock in filteredStocks" :key="stock.symbol" :to="`/stocks/${stock.symbol}`" class="card bg-base-100 shadow hover:shadow-md transition-shadow cursor-pointer block">
        <div class="card-body p-4 flex-row justify-between items-center">
          <div>
            <p class="font-bold">{{ stock.symbol }}</p>
            <p class="text-xs text-base-content/60">{{ stock.companyName }}</p>
            <div class="flex gap-1 mt-1">
              <span v-if="stock.sector" class="badge badge-ghost badge-xs">{{ stock.sector }}</span>
              <span v-if="stock.exchangeShortName" class="badge badge-ghost badge-xs">{{ stock.exchangeShortName }}</span>
            </div>
          </div>
          <div class="text-right">
            <p class="font-semibold" v-if="stock.price">${{ Number(stock.price).toFixed(2) }}</p>
            <p class="text-xs text-base-content/50" v-if="stock.marketCap">
              ${{ formatMarketCap(stock.marketCap) }}
            </p>
          </div>
        </div>
      </RouterLink>
      <p v-if="filteredStocks.length === 0" class="text-center text-base-content/50 py-8">No stocks match your filters.</p>
    </div>

    <!-- Baskets (shown when no search AND no filters) -->
    <div v-if="!searchQuery && !hasActiveFilters && !loading">
      <!-- Create Basket Form (inline) -->
      <div v-if="showCreateForm" class="card bg-base-100 shadow mb-4">
        <div class="card-body p-4 space-y-3">
          <h3 class="font-bold">Create Custom Basket</h3>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Basket Name</span></label>
            <input v-model="newBasket.name" type="text" class="input input-bordered w-full" placeholder="e.g., My Tech Picks" maxlength="60" />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Description (optional)</span></label>
            <input v-model="newBasket.description" type="text" class="input input-bordered w-full" placeholder="Short description" maxlength="120" />
          </div>
          <!-- Ticker search + chips -->
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Stocks</span></label>
            <div v-if="newBasket.tickers.length > 0" class="flex flex-wrap gap-1 mb-2">
              <span v-for="t in newBasket.tickers" :key="t" class="badge badge-primary gap-1">
                {{ t }}
                <button class="btn btn-ghost btn-xs px-0" @click="removeTickerFromNew(t)">&#10005;</button>
              </span>
            </div>
            <input
              v-model="tickerSearch"
              type="text"
              class="input input-bordered w-full"
              placeholder="Search to add stocks..."
              @input="handleTickerSearch"
            />
            <ul v-if="tickerResults.length > 0" class="menu bg-base-200 rounded-box mt-1 max-h-40 overflow-y-auto">
              <li v-for="r in tickerResults" :key="r.symbol">
                <a @click="addTickerToNew(r.symbol)">
                  <span class="font-bold">{{ r.symbol }}</span>
                  <span class="text-xs text-base-content/60">{{ r.name }}</span>
                </a>
              </li>
            </ul>
          </div>
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" v-model="newBasket.isPublic" class="checkbox checkbox-sm" />
            <span class="label-text text-sm">Make public (visible on your profile)</span>
          </label>
          <div v-if="createError" class="text-error text-sm">{{ createError }}</div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-ghost" @click="cancelCreate">Cancel</button>
            <button class="btn btn-sm btn-primary flex-1" :disabled="!canSaveBasket || savingBasket" @click="saveBasket">
              <span v-if="savingBasket" class="loading loading-spinner loading-xs"></span>
              Save Basket
            </button>
          </div>
        </div>
      </div>

      <!-- Edit Basket Form (inline) -->
      <div v-if="editingBasket" class="card bg-base-100 shadow mb-4">
        <div class="card-body p-4 space-y-3">
          <h3 class="font-bold">Edit Basket</h3>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Basket Name</span></label>
            <input v-model="editForm.name" type="text" class="input input-bordered w-full" maxlength="60" />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Description</span></label>
            <input v-model="editForm.description" type="text" class="input input-bordered w-full" maxlength="120" />
          </div>
          <div class="form-control">
            <label class="label py-1"><span class="label-text text-sm">Stocks</span></label>
            <div v-if="editForm.tickers.length > 0" class="flex flex-wrap gap-1 mb-2">
              <span v-for="t in editForm.tickers" :key="t" class="badge badge-primary gap-1">
                {{ t }}
                <button class="btn btn-ghost btn-xs px-0" @click="editForm.tickers = editForm.tickers.filter(x => x !== t)">&#10005;</button>
              </span>
            </div>
            <input
              v-model="tickerSearch"
              type="text"
              class="input input-bordered w-full"
              placeholder="Search to add stocks..."
              @input="handleTickerSearch"
            />
            <ul v-if="tickerResults.length > 0" class="menu bg-base-200 rounded-box mt-1 max-h-40 overflow-y-auto">
              <li v-for="r in tickerResults" :key="r.symbol">
                <a @click="addTickerToEdit(r.symbol)">
                  <span class="font-bold">{{ r.symbol }}</span>
                  <span class="text-xs text-base-content/60">{{ r.name }}</span>
                </a>
              </li>
            </ul>
          </div>
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" v-model="editForm.isPublic" class="checkbox checkbox-sm" />
            <span class="label-text text-sm">Make public</span>
          </label>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-ghost" @click="editingBasket = null">Cancel</button>
            <button class="btn btn-sm btn-primary flex-1" :disabled="!editForm.name || editForm.tickers.length === 0 || savingBasket" @click="saveEdit">
              <span v-if="savingBasket" class="loading loading-spinner loading-xs"></span>
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <!-- Expanded basket view -->
      <div v-if="expandedBasket" class="space-y-3">
        <button class="btn btn-ghost btn-sm gap-1" @click="collapseBasket">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          Back to Baskets
        </button>
        <h2 class="text-lg font-bold">{{ expandedBasket.icon || '' }} {{ expandedBasket.name }}</h2>

        <div v-if="basketLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <div v-else class="space-y-4">
          <!-- Stock list -->
          <div class="space-y-2">
            <RouterLink v-for="stock in basketStocks" :key="stock.symbol" :to="`/stocks/${stock.symbol}`" class="card bg-base-100 shadow hover:shadow-md transition-shadow cursor-pointer block">
              <div class="card-body p-4 flex-row justify-between items-center">
                <div>
                  <p class="font-bold">{{ stock.symbol }}</p>
                  <p class="text-xs text-base-content/60">{{ stock.name }}</p>
                </div>
                <div class="text-right" v-if="stock.price">
                  <p class="font-semibold">${{ Number(stock.price).toFixed(2) }}</p>
                  <p v-if="stock.changesPercentage != null" class="text-sm" :class="stock.changesPercentage >= 0 ? 'text-success' : 'text-error'">
                    {{ stock.changesPercentage >= 0 ? '+' : '' }}{{ Number(stock.changesPercentage).toFixed(2) }}%
                  </p>
                </div>
              </div>
            </RouterLink>
          </div>

          <!-- Buy This Basket section -->
          <div v-if="!auth.isTeacher && !auth.isAdmin && basketStocks.length > 0 && expandedBasket.type !== 'dynamic'" class="card bg-base-100 shadow">
            <div class="card-body p-4 space-y-3">
              <h3 class="font-semibold">Buy This Basket</h3>
              <p class="text-xs text-base-content/60">Equal-weight across {{ basketStocks.length }} stocks</p>

              <div class="flex justify-between text-sm bg-base-200 rounded-lg p-2">
                <span class="text-base-content/60">Cash available</span>
                <span class="font-medium">${{ portfolioStore.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
              </div>

              <!-- Dollar Input -->
              <div class="form-control">
                <label class="label py-1"><span class="label-text text-sm">Total Amount ($)</span></label>
                <input v-model.number="basketBuyAmount" type="number" min="0" :max="portfolioStore.cashBalance" step="0.01" class="input input-bordered w-full" placeholder="Enter total $ to invest" />
              </div>

              <!-- Quick % buttons -->
              <div class="flex gap-1">
                <button v-for="pct in [25, 50, 75, 100]" :key="pct" class="btn btn-xs btn-ghost flex-1" @click="basketBuyAmount = Math.floor(portfolioStore.cashBalance * (pct / 100) * 100) / 100">{{ pct }}%</button>
              </div>

              <!-- Preview table -->
              <div v-if="basketBuyAmount > 0" class="overflow-x-auto">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>Stock</th>
                      <th class="text-right">Amount</th>
                      <th class="text-right">Est. Shares</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="stock in basketPreview" :key="stock.symbol">
                      <td class="font-mono font-bold">{{ stock.symbol }}</td>
                      <td class="text-right font-mono">${{ stock.amount.toFixed(2) }}</td>
                      <td class="text-right font-mono">{{ stock.shares.toFixed(4) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Approval code -->
              <div v-if="requiresApproval" class="form-control">
                <label class="label py-1"><span class="label-text text-sm">Teacher Approval Code</span></label>
                <input v-model="basketApprovalCode" type="text" class="input input-bordered w-full uppercase" placeholder="Enter approval code" />
              </div>

              <!-- Buy progress -->
              <div v-if="basketBuyProgress" class="text-sm text-center">
                <span class="loading loading-spinner loading-xs mr-1"></span>
                Buying {{ basketBuyProgress.current }}/{{ basketBuyProgress.total }}...
              </div>

              <!-- Result -->
              <div v-if="basketBuyResult" class="alert" :class="basketBuyResult.success ? 'alert-success' : 'alert-error'">
                <span>{{ basketBuyResult.message }}</span>
              </div>

              <!-- Execute -->
              <button
                class="btn btn-success btn-block"
                :disabled="!canBuyBasket || !!basketBuyProgress"
                @click="executeBuyBasket"
              >
                Buy All {{ basketStocks.length }} Stocks
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Baskets grid -->
      <div v-if="!expandedBasket && !showCreateForm && !editingBasket" class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <!-- Create basket card -->
        <button class="card border-2 border-dashed border-base-300 hover:border-primary transition-colors text-left" @click="showCreateForm = true">
          <div class="card-body p-4 flex flex-col items-center justify-center text-center">
            <div class="text-3xl text-base-content/30">+</div>
            <p class="font-bold text-sm text-base-content/60">Create My Own Basket</p>
          </div>
        </button>

        <!-- Custom baskets -->
        <div v-for="basket in basketsStore.myBaskets" :key="basket.id" class="card bg-base-100 shadow hover:shadow-md transition-shadow relative">
          <div class="absolute top-2 right-2 flex gap-1 z-10">
            <button class="btn btn-ghost btn-xs" @click.stop="startEdit(basket)" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button class="btn btn-ghost btn-xs text-error" @click.stop="confirmDelete(basket)" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
          <button class="card-body p-4 text-left w-full" @click="expandCustomBasket(basket)">
            <div class="text-2xl">{{ basket.is_public ? '\u{1F310}' : '\u{1F512}' }}</div>
            <p class="font-bold text-sm">{{ basket.name }}</p>
            <p class="text-xs text-base-content/60">{{ basket.tickers.length }} stocks{{ basket.description ? ' - ' + basket.description : '' }}</p>
          </button>
        </div>

        <!-- Preset baskets -->
        <button v-for="basket in presetBaskets" :key="basket.name" class="card bg-base-100 shadow hover:shadow-md transition-shadow text-left" @click="expandBasket(basket)">
          <div class="card-body p-4">
            <div class="text-2xl">{{ basket.icon }}</div>
            <p class="font-bold text-sm">{{ basket.name }}</p>
            <p class="text-xs text-base-content/60">{{ basket.description }}</p>
          </div>
        </button>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <dialog ref="deleteModal" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Delete Basket</h3>
        <p class="py-4">Are you sure you want to delete "{{ deletingBasket?.name }}"? This cannot be undone.</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="deleteModal?.close()">Cancel</button>
          <button class="btn btn-error" @click="doDelete">Delete</button>
        </div>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useMarketDataStore } from '../../stores/marketData'
import { usePortfolioStore } from '../../stores/portfolio'
import { useAuthStore } from '../../stores/auth'
import { useBasketsStore } from '../../stores/baskets'

const market = useMarketDataStore()
const portfolioStore = usePortfolioStore()
const auth = useAuthStore()
const basketsStore = useBasketsStore()

const searchQuery = ref('')
const displayStocks = ref([])
const loading = ref(false)
let searchTimeout = null

const expandedBasket = ref(null)
const basketStocks = ref([])
const basketLoading = ref(false)

// Create basket state
const showCreateForm = ref(false)
const newBasket = reactive({ name: '', description: '', tickers: [], isPublic: false })
const tickerSearch = ref('')
const tickerResults = ref([])
const createError = ref('')
const savingBasket = ref(false)
let tickerSearchTimeout = null

// Edit basket state
const editingBasket = ref(null)
const editForm = reactive({ name: '', description: '', tickers: [], isPublic: false })

// Delete state
const deletingBasket = ref(null)
const deleteModal = ref(null)

// Buy basket state
const basketBuyAmount = ref(0)
const basketApprovalCode = ref('')
const basketBuyProgress = ref(null)
const basketBuyResult = ref(null)
const requiresApproval = ref(false)

// Filter state
const activeFilters = reactive({ sector: null, size: null, style: null, assetType: null, region: null, riskExposure: null })
const filteredStocks = ref([])
const hasActiveFilters = computed(() => !!(activeFilters.sector || activeFilters.size || activeFilters.style || activeFilters.assetType || activeFilters.region || activeFilters.riskExposure))

const canSaveBasket = computed(() => newBasket.name.trim() && newBasket.tickers.length > 0)
const canBuyBasket = computed(() => {
  if (!basketBuyAmount.value || basketBuyAmount.value <= 0) return false
  if (basketBuyAmount.value > portfolioStore.cashBalance) return false
  if (requiresApproval.value && !basketApprovalCode.value.trim()) return false
  return basketStocks.value.length > 0
})

const basketPreview = computed(() => {
  if (!basketBuyAmount.value || basketStocks.value.length === 0) return []
  const perStock = basketBuyAmount.value / basketStocks.value.length
  return basketStocks.value.map(s => ({
    symbol: s.symbol,
    amount: perStock,
    shares: s.price ? perStock / s.price : 0
  }))
})

onMounted(async () => {
  basketsStore.loadMyBaskets()
  // Check approval requirement
  const membership = await auth.getCurrentMembership()
  if (membership?.class?.approval_code) {
    requiresApproval.value = true
  }
})

const sectorOptions = [
  'Technology', 'Healthcare', 'Financial Services', 'Energy',
  'Consumer Cyclical', 'Industrials', 'Communication Services',
  'Real Estate', 'Consumer Defensive', 'Utilities', 'Basic Materials'
]
const sizeOptions = [
  { label: 'Large Cap (>$10B)', marketCapMoreThan: 10000000000 },
  { label: 'Mid Cap ($2B-$10B)', marketCapMoreThan: 2000000000, marketCapLowerThan: 10000000000 },
  { label: 'Small Cap (<$2B)', marketCapLowerThan: 2000000000 }
]
const styleOptions = [
  { label: 'Value', dividendMoreThan: 0, betaLowerThan: 1 },
  { label: 'Growth', betaMoreThan: 1.2 }
]
const assetTypeOptions = [
  { label: 'Individual Stocks', isEtf: false },
  { label: 'Funds (ETFs)', isEtf: true }
]
const regionOptions = [
  { label: 'U.S.', countries: ['US'] },
  { label: 'Int\'l Developed', countries: ['GB', 'JP', 'DE', 'FR', 'CA', 'AU', 'CH'] },
  { label: 'Emerging Markets', countries: ['CN', 'IN', 'BR', 'KR', 'TW', 'MX', 'ZA'] }
]
const riskExposureOptions = [
  { label: 'Stocks', tickers: null },
  { label: 'Bonds', tickers: ['BND', 'AGG', 'TLT', 'LQD', 'HYG', 'MUB', 'BNDX', 'VCIT', 'VCSH', 'BSV'] },
  { label: 'Cash Equivalents', tickers: ['SHV', 'BIL', 'SGOV', 'MINT', 'FLOT', 'NEAR', 'JPST', 'SCHO'] }
]

const presetBaskets = [
  { name: 'Big Tech', icon: '\u{1F4BB}', description: 'FAANG+ & top tech giants', type: 'static', tickers: ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','AVGO','ORCL','CRM'] },
  { name: 'Top ETFs', icon: '\u{1F4CA}', description: 'Most popular index & sector ETFs', type: 'static', tickers: ['SPY','QQQ','IWM','DIA','VTI','VOO','ARKK','XLF','XLE','XLK'] },
  { name: "Today's Biggest Gainers", icon: '\u{1F680}', description: 'Top movers trending up today', type: 'dynamic', fetch: 'gainers' },
  { name: "Today's Biggest Losers", icon: '\u{1F4C9}', description: 'Biggest drops on the day', type: 'dynamic', fetch: 'losers' },
  { name: 'Healthcare & Biotech', icon: '\u{1F9EC}', description: 'Pharma, biotech & health leaders', type: 'static', tickers: ['JNJ','UNH','PFE','ABBV','MRK','LLY','TMO','ABT','AMGN','GILD'] },
  { name: 'Clean Energy & EVs', icon: '\u26A1', description: 'Solar, EVs & renewable energy', type: 'static', tickers: ['TSLA','ENPH','FSLR','PLUG','NIO','RIVN','LCID','BE','SEDG','RUN'] },
  { name: 'Gaming & Entertainment', icon: '\u{1F3AE}', description: 'Streaming, gaming & media', type: 'static', tickers: ['NFLX','DIS','EA','TTWO','RBLX','SONY','SPOT','WBD','LYV','PARA'] },
  { name: 'Finance & Banks', icon: '\u{1F3E6}', description: 'Major banks & financial services', type: 'static', tickers: ['JPM','BAC','GS','MS','WFC','C','BLK','SCHW','AXP','V'] },
]

function setFilter(key, value) {
  if (activeFilters[key] === value) {
    activeFilters[key] = null
  } else {
    activeFilters[key] = value
  }
  document.activeElement?.blur()
  if (hasActiveFilters.value) {
    runScreener()
  } else {
    filteredStocks.value = []
  }
}

function removeFilter(key) {
  activeFilters[key] = null
  if (hasActiveFilters.value) {
    runScreener()
  } else {
    filteredStocks.value = []
  }
}

function clearFilters() {
  activeFilters.sector = null
  activeFilters.size = null
  activeFilters.style = null
  activeFilters.assetType = null
  activeFilters.region = null
  activeFilters.riskExposure = null
  filteredStocks.value = []
}

async function runScreener() {
  const riskObj = riskExposureOptions.find(r => r.label === activeFilters.riskExposure)
  if (riskObj?.tickers) {
    loading.value = true
    const quotes = await market.fetchBatchQuotes(riskObj.tickers)
    filteredStocks.value = riskObj.tickers.map(ticker => {
      const q = quotes.find(qu => qu.symbol === ticker)
      return { symbol: ticker, companyName: q?.name || '', price: q?.price, marketCap: q?.marketCap, changesPercentage: q?.changesPercentage }
    })
    loading.value = false
    return
  }

  const params = {}
  if (activeFilters.sector) params.sector = activeFilters.sector
  if (activeFilters.assetType) {
    const typeObj = assetTypeOptions.find(t => t.label === activeFilters.assetType)
    if (typeObj) params.isEtf = typeObj.isEtf
  }
  if (activeFilters.size) {
    const sizeObj = sizeOptions.find(s => s.label === activeFilters.size)
    if (sizeObj?.marketCapMoreThan) params.marketCapMoreThan = sizeObj.marketCapMoreThan
    if (sizeObj?.marketCapLowerThan) params.marketCapLowerThan = sizeObj.marketCapLowerThan
  }
  if (activeFilters.style) {
    const styleObj = styleOptions.find(s => s.label === activeFilters.style)
    if (styleObj?.dividendMoreThan !== undefined) params.dividendMoreThan = styleObj.dividendMoreThan
    if (styleObj?.betaLowerThan) params.betaLowerThan = styleObj.betaLowerThan
    if (styleObj?.betaMoreThan) params.betaMoreThan = styleObj.betaMoreThan
  }

  const regionObj = regionOptions.find(r => r.label === activeFilters.region)
  loading.value = true
  if (regionObj && regionObj.countries.length > 1) {
    filteredStocks.value = await market.screenStocksMultiCountry(regionObj.countries, params)
  } else {
    if (regionObj) params.country = regionObj.countries[0]
    filteredStocks.value = await market.screenStocks(params)
  }
  loading.value = false
}

function formatMarketCap(cap) {
  if (cap >= 1e12) return (cap / 1e12).toFixed(1) + 'T'
  if (cap >= 1e9) return (cap / 1e9).toFixed(1) + 'B'
  if (cap >= 1e6) return (cap / 1e6).toFixed(0) + 'M'
  return cap.toLocaleString()
}

function handleSearch() {
  clearTimeout(searchTimeout)
  if (!searchQuery.value.trim()) {
    displayStocks.value = []
    return
  }
  searchTimeout = setTimeout(async () => {
    loading.value = true
    const results = await market.searchStocks(searchQuery.value)
    if (results.length > 0) {
      const tickers = results.slice(0, 10).map(r => r.symbol)
      const quotes = await market.fetchBatchQuotes(tickers)
      displayStocks.value = results.slice(0, 20).map(r => {
        const quote = quotes.find(q => q.symbol === r.symbol)
        return { ...r, price: quote?.price, changesPercentage: quote?.changesPercentage }
      })
    } else {
      displayStocks.value = []
    }
    loading.value = false
  }, 300)
}

// Ticker search for basket creation
function handleTickerSearch() {
  clearTimeout(tickerSearchTimeout)
  if (!tickerSearch.value.trim()) {
    tickerResults.value = []
    return
  }
  tickerSearchTimeout = setTimeout(async () => {
    const results = await market.searchStocks(tickerSearch.value)
    tickerResults.value = results.slice(0, 6)
  }, 300)
}

function addTickerToNew(symbol) {
  if (!newBasket.tickers.includes(symbol)) {
    newBasket.tickers.push(symbol)
  }
  tickerSearch.value = ''
  tickerResults.value = []
}

function removeTickerFromNew(symbol) {
  newBasket.tickers = newBasket.tickers.filter(t => t !== symbol)
}

function addTickerToEdit(symbol) {
  if (!editForm.tickers.includes(symbol)) {
    editForm.tickers.push(symbol)
  }
  tickerSearch.value = ''
  tickerResults.value = []
}

function cancelCreate() {
  showCreateForm.value = false
  newBasket.name = ''
  newBasket.description = ''
  newBasket.tickers = []
  newBasket.isPublic = false
  createError.value = ''
}

async function saveBasket() {
  createError.value = ''
  savingBasket.value = true
  const result = await basketsStore.createBasket({
    name: newBasket.name.trim(),
    description: newBasket.description.trim() || null,
    tickers: newBasket.tickers,
    isPublic: newBasket.isPublic
  })
  savingBasket.value = false
  if (result.error) {
    createError.value = result.error
    return
  }
  cancelCreate()
}

function startEdit(basket) {
  editingBasket.value = basket
  editForm.name = basket.name
  editForm.description = basket.description || ''
  editForm.tickers = [...basket.tickers]
  editForm.isPublic = basket.is_public
}

async function saveEdit() {
  savingBasket.value = true
  await basketsStore.updateBasket(editingBasket.value.id, {
    name: editForm.name.trim(),
    description: editForm.description.trim() || null,
    tickers: editForm.tickers,
    is_public: editForm.isPublic
  })
  savingBasket.value = false
  editingBasket.value = null
}

function confirmDelete(basket) {
  deletingBasket.value = basket
  deleteModal.value?.showModal()
}

async function doDelete() {
  if (deletingBasket.value) {
    await basketsStore.deleteBasket(deletingBasket.value.id)
    deletingBasket.value = null
  }
  deleteModal.value?.close()
}

// Expand custom basket (from DB)
async function expandCustomBasket(basket) {
  expandedBasket.value = { ...basket, type: 'static', tickers: basket.tickers }
  basketStocks.value = []
  basketLoading.value = true
  basketBuyAmount.value = 0
  basketBuyResult.value = null

  try {
    const quotes = await market.fetchBatchQuotes(basket.tickers)
    basketStocks.value = basket.tickers.map(ticker => {
      const quote = quotes.find(q => q.symbol === ticker)
      return { symbol: ticker, name: quote?.name || '', price: quote?.price, changesPercentage: quote?.changesPercentage }
    })
  } catch (e) {
    console.error('Failed to load basket:', e)
  } finally {
    basketLoading.value = false
  }
}

// Expand preset basket
async function expandBasket(basket) {
  expandedBasket.value = basket
  basketStocks.value = []
  basketLoading.value = true
  basketBuyAmount.value = 0
  basketBuyResult.value = null

  try {
    if (basket.type === 'dynamic') {
      const data = basket.fetch === 'gainers'
        ? await market.fetchGainers()
        : await market.fetchLosers()
      basketStocks.value = (data || []).map(s => ({
        symbol: s.symbol || s.ticker,
        name: s.name || s.companyName || '',
        price: s.price,
        changesPercentage: s.changesPercentage
      }))
    } else {
      const quotes = await market.fetchBatchQuotes(basket.tickers)
      basketStocks.value = basket.tickers.map(ticker => {
        const quote = quotes.find(q => q.symbol === ticker)
        return { symbol: ticker, name: quote?.name || '', price: quote?.price, changesPercentage: quote?.changesPercentage }
      })
    }
  } catch (e) {
    console.error('Failed to load basket:', e)
  } finally {
    basketLoading.value = false
  }
}

function collapseBasket() {
  expandedBasket.value = null
  basketStocks.value = []
  basketBuyAmount.value = 0
  basketBuyResult.value = null
  basketBuyProgress.value = null
}

async function executeBuyBasket() {
  const stocks = basketStocks.value.filter(s => s.price)
  if (stocks.length === 0) return

  const perStock = basketBuyAmount.value / stocks.length
  basketBuyProgress.value = { current: 0, total: stocks.length }
  basketBuyResult.value = null

  let successes = 0
  let failures = []
  const code = basketApprovalCode.value.trim() || undefined

  for (let i = 0; i < stocks.length; i++) {
    basketBuyProgress.value = { current: i + 1, total: stocks.length }
    const result = await portfolioStore.buyStock(stocks[i].symbol, perStock, code)
    if (result.success) {
      successes++
    } else {
      failures.push(`${stocks[i].symbol}: ${result.error}`)
    }
  }

  basketBuyProgress.value = null

  if (failures.length === 0) {
    basketBuyResult.value = {
      success: true,
      message: `Bought ${successes} stocks ($${perStock.toFixed(2)} each, $${basketBuyAmount.value.toFixed(2)} total)`
    }
  } else {
    basketBuyResult.value = {
      success: false,
      message: `${successes} bought, ${failures.length} failed: ${failures.join('; ')}`
    }
  }

  basketBuyAmount.value = 0
}
</script>
