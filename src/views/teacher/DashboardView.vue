<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3">
      <div class="space-y-3">
        <h1 class="text-xl font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          Dashboard
        </h1>
        <p class="text-sm text-base-content/60 mt-1">Overview of <strong>{{ currentClass?.class_name }}</strong> &mdash; {{ currentClass?.school }}</p>
        <p class="text-xs text-base-content/45">Use Quick Actions for outreach, notes, and investing tools.</p>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <template v-else>
      <div class="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body p-4">
            <div class="text-xs uppercase tracking-wide text-base-content/50">Groups</div>
            <div class="text-3xl font-bold text-primary">{{ classGroups.length }}</div>
          </div>
        </div>
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body p-4">
            <div class="text-xs uppercase tracking-wide text-base-content/50">Students</div>
            <div class="text-3xl font-bold text-secondary">{{ classStudents.length }}</div>
          </div>
        </div>
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body p-4">
            <div class="text-xs uppercase tracking-wide text-base-content/50">Aggregate Return</div>
            <div class="text-3xl font-bold" :class="dashboardSummary.returnPct >= 0 ? 'text-success' : 'text-error'">
              {{ dashboardSummary.returnPct >= 0 ? '+' : '' }}{{ dashboardSummary.returnPct.toFixed(2) }}%
            </div>
          </div>
        </div>
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body p-4">
            <div class="text-xs uppercase tracking-wide text-base-content/50">Total Portfolio Value</div>
            <div class="text-3xl font-bold">${{ dashboardSummary.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</div>
          </div>
        </div>
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body p-4">
            <div class="text-xs uppercase tracking-wide text-base-content/50">Uninvested Cash</div>
            <div class="text-3xl font-bold text-info">${{ dashboardSummary.cash.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</div>
          </div>
        </div>
      </div>

      <!-- S&P 500 Performance Stats -->
      <div class="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body p-4">
            <div class="text-[10px] uppercase tracking-wider text-base-content/50 leading-tight">Students Beating<br>S&P 500</div>
            <div class="text-2xl font-bold mt-1" :class="leaderboardStats.pctStudentsBeating > 50 ? 'text-success' : 'text-base-content'">
              {{ Math.round(leaderboardStats.pctStudentsBeating) }}%
            </div>
          </div>
        </div>
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body p-4">
            <div class="text-[10px] uppercase tracking-wider text-base-content/50 leading-tight">Groups Beating<br>S&P 500</div>
            <div class="text-2xl font-bold mt-1" :class="leaderboardStats.pctGroupsBeating > 50 ? 'text-success' : 'text-base-content'">
              {{ Math.round(leaderboardStats.pctGroupsBeating) }}%
            </div>
          </div>
        </div>
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body p-4">
            <div class="text-[10px] uppercase tracking-wider text-base-content/50 leading-tight">Funds Beating<br>S&P 500</div>
            <div class="text-2xl font-bold mt-1" :class="leaderboardStats.pctFundsBeating > 50 ? 'text-success' : 'text-base-content'">
              {{ Math.round(leaderboardStats.pctFundsBeating) }}%
            </div>
          </div>
        </div>
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body p-4">
            <div class="text-[10px] uppercase tracking-wider text-base-content/50 leading-tight">Max Alpha<br>(Beating by)</div>
            <div class="text-2xl font-bold text-success mt-1">+{{ leaderboardStats.maxAlpha.toFixed(1) }}%</div>
          </div>
        </div>
        <div class="card bg-base-100 shadow border border-base-200">
          <div class="card-body p-4">
            <div class="text-[10px] uppercase tracking-wider text-base-content/50 leading-tight">Min Alpha<br>(Trailing by)</div>
            <div class="text-2xl font-bold text-error mt-1">{{ leaderboardStats.minAlpha.toFixed(1) }}%</div>
          </div>
        </div>
      </div>

      <div class="card bg-base-100 shadow border border-base-200">
        <div class="card-body p-5 xl:p-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 class="card-title">Quick Actions</h2>
              <p class="text-sm text-base-content/55">The main teacher workflows are centralized here.</p>
            </div>
            <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <button class="btn btn-outline btn-sm gap-2" :disabled="!classStudents.length" @click="openClassContactsModal">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8m-18 8h18a2 2 0 002-2V8a2 2 0 00-2-2H3a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                Contacts
              </button>
              <RouterLink
                :to="{ name: 'teacher-messages', query: { class_id: currentClass?.id, recipient: 'class' } }"
                class="btn btn-outline btn-sm gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Message Class
              </RouterLink>
              <RouterLink to="/teacher/portfolio" class="btn btn-outline btn-sm gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Investing
              </RouterLink>
              <button class="btn btn-primary btn-sm gap-2" @click="showNotesModal = true" :disabled="loading">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Class Notes
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs: Leaderboard | vs S&P 500 -->
      <div class="card bg-base-100 shadow border border-base-200">
        <div class="card-body p-5 xl:p-6">
          <div class="tabs tabs-bordered mb-4">
            <a class="tab" :class="{ 'tab-active': activeTab === 'leaderboard' }" @click="activeTab = 'leaderboard'">Group Leaderboard</a>
            <a class="tab" :class="{ 'tab-active': activeTab === 'benchmark' }" @click="activeTab = 'benchmark'">vs S&P 500</a>
          </div>

          <div v-if="leaderboardError" class="text-xs text-error mb-2">{{ leaderboardError }}</div>

          <div v-if="leaderboardLoading" class="flex justify-center py-8">
            <span class="loading loading-spinner loading-md"></span>
          </div>

          <!-- Leaderboard Tab -->
          <template v-else-if="activeTab === 'leaderboard'">
            <p class="text-xs text-base-content/50 mb-3">Each group's total assets under management and since-inception return.</p>
            <div class="overflow-x-auto">
              <table class="table w-full">
                <thead>
                  <tr>
                    <th class="w-12">Rank</th>
                    <th>Group</th>
                    <th>Members</th>
                    <th class="text-right">Funds</th>
                    <th class="text-right">AUM</th>
                    <th class="text-right">Cash</th>
                    <th class="text-right">Return</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(group, i) in leaderboardGroups" :key="group.id" class="hover">
                    <td>
                      <span class="badge badge-lg" :class="i === 0 ? 'badge-warning' : 'badge-ghost'">{{ i + 1 }}</span>
                    </td>
                    <td class="font-semibold">{{ group.name }}</td>
                    <td>
                      <div class="flex flex-wrap gap-1">
                        <span v-for="name in group.members" :key="name" class="badge badge-sm badge-outline whitespace-nowrap">{{ name.split(' ')[0] }}</span>
                      </div>
                    </td>
                    <td class="text-right text-sm text-base-content/60">{{ group.fundCount }}</td>
                    <td class="text-right font-mono text-sm font-semibold">${{ formatMoney(group.totalValue) }}</td>
                    <td class="text-right font-mono text-sm text-base-content/60">${{ formatMoney(group.cash) }}</td>
                    <td class="text-right font-mono text-sm font-semibold" :class="group.returnPct >= 0 ? 'text-success' : 'text-error'">
                      {{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%
                    </td>
                  </tr>
                  <tr v-if="leaderboardGroups.length === 0">
                    <td colspan="7" class="text-center text-base-content/50 py-8">No groups yet</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <!-- vs S&P 500 Tab -->
          <template v-else-if="activeTab === 'benchmark'">
            <!-- Group-level benchmark -->
            <div class="mb-10">
              <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
                <div>
                  <h3 class="font-bold text-lg mb-1">By Group</h3>
                  <p class="text-xs text-base-content/50">Each group's aggregate return compared to the S&P 500 over the same period.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <div class="relative">
                    <input v-model="groupSearch" type="text" placeholder="Search group..." class="input input-bordered input-sm w-full sm:w-48 pl-8" />
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-2.5 top-2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <select v-model="groupStatusFilter" class="select select-bordered select-sm">
                    <option value="all">All Status</option>
                    <option value="beating">Beating Only</option>
                    <option value="trailing">Trailing Only</option>
                  </select>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="table w-full">
                  <thead>
                    <tr>
                      <th class="cursor-pointer hover:bg-base-200 transition-colors" @click="toggleGroupSort('name')">
                        Group <span class="text-[10px] ml-1 opacity-50">{{ getSortIcon('name', groupSortKey, groupSortOrder) }}</span>
                      </th>
                      <th class="text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleGroupSort('returnPct')">
                        Group Return <span class="text-[10px] ml-1 opacity-50">{{ getSortIcon('returnPct', groupSortKey, groupSortOrder) }}</span>
                      </th>
                      <th class="text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleGroupSort('benchmarkReturnPct')">
                        S&P 500 <span class="text-[10px] ml-1 opacity-50">{{ getSortIcon('benchmarkReturnPct', groupSortKey, groupSortOrder) }}</span>
                      </th>
                      <th class="text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleGroupSort('alpha')">
                        Alpha <span class="text-[10px] ml-1 opacity-50">{{ getSortIcon('alpha', groupSortKey, groupSortOrder) }}</span>
                      </th>
                      <th class="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="group in benchmarkGroupsSorted" :key="group.id" class="hover">
                      <td class="font-semibold">{{ group.name }}</td>
                      <td class="text-right font-mono text-sm font-semibold" :class="group.returnPct >= 0 ? 'text-success' : 'text-error'">
                        {{ group.returnPct >= 0 ? '+' : '' }}{{ group.returnPct.toFixed(2) }}%
                      </td>
                      <td class="text-right font-mono text-sm text-base-content/60">
                        {{ (group.benchmarkReturnPct || 0) >= 0 ? '+' : '' }}{{ (group.benchmarkReturnPct || 0).toFixed(2) }}%
                      </td>
                      <td class="text-right font-mono text-sm font-semibold" :class="(group.returnPct - (group.benchmarkReturnPct || 0)) >= 0 ? 'text-success' : 'text-error'">
                        {{ (group.returnPct - (group.benchmarkReturnPct || 0)) >= 0 ? '+' : '' }}{{ (group.returnPct - (group.benchmarkReturnPct || 0)).toFixed(2) }}%
                      </td>
                      <td class="text-center">
                        <div class="flex flex-col items-center gap-1.5">
                          <span v-if="group.isBeatingSP500" class="badge badge-success badge-sm gap-1">Beating</span>
                          <span v-else class="badge badge-error badge-sm gap-1">Trailing</span>
                          <button class="btn btn-ghost btn-xs text-[10px] text-primary" @click="openAttributionModal(group)">Explain</button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="benchmarkGroupsSorted.length === 0">
                      <td colspan="5" class="text-center text-base-content/50 py-12">
                        <div class="text-2xl mb-2">🔍</div>
                        No groups found matching filters
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Fund-level benchmark -->
            <div>
              <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
                <div>
                  <h3 class="font-bold text-lg mb-1">By Fund</h3>
                  <p class="text-xs text-base-content/50">Each individual fund's return compared to the S&P 500 since inception.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <div class="relative">
                    <input v-model="fundSearch" type="text" placeholder="Search fund or group..." class="input input-bordered input-sm w-full sm:w-64 pl-8" />
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-2.5 top-2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <select v-model="fundStatusFilter" class="select select-bordered select-sm">
                    <option value="all">All Status</option>
                    <option value="beating">Beating Only</option>
                    <option value="trailing">Trailing Only</option>
                  </select>
                </div>
              </div>

              <div class="overflow-x-auto">
                <table class="table w-full">
                  <thead>
                    <tr>
                      <th class="cursor-pointer hover:bg-base-200 transition-colors" @click="toggleFundSort('groupName')">
                        Group <span class="text-[10px] ml-1 opacity-50">{{ getSortIcon('groupName', fundSortKey, fundSortOrder) }}</span>
                      </th>
                      <th class="cursor-pointer hover:bg-base-200 transition-colors" @click="toggleFundSort('fundName')">
                        Fund <span class="text-[10px] ml-1 opacity-50">{{ getSortIcon('fundName', fundSortKey, fundSortOrder) }}</span>
                      </th>
                      <th class="text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleFundSort('returnPct')">
                        Fund Return <span class="text-[10px] ml-1 opacity-50">{{ getSortIcon('returnPct', fundSortKey, fundSortOrder) }}</span>
                      </th>
                      <th class="text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleFundSort('benchmarkReturnPct')">
                        S&P 500 <span class="text-[10px] ml-1 opacity-50">{{ getSortIcon('benchmarkReturnPct', fundSortKey, fundSortOrder) }}</span>
                      </th>
                      <th class="text-right cursor-pointer hover:bg-base-200 transition-colors" @click="toggleFundSort('alpha')">
                        Alpha <span class="text-[10px] ml-1 opacity-50">{{ getSortIcon('alpha', fundSortKey, fundSortOrder) }}</span>
                      </th>
                      <th class="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in benchmarkFundRows" :key="row.fundId" class="hover">
                      <td class="text-sm">{{ row.groupName }}</td>
                      <td class="font-semibold text-sm">{{ row.fundName }}</td>
                      <td class="text-right font-mono text-sm font-semibold" :class="row.returnPct >= 0 ? 'text-success' : 'text-error'">
                        {{ row.returnPct >= 0 ? '+' : '' }}{{ row.returnPct.toFixed(2) }}%
                      </td>
                      <td class="text-right font-mono text-sm text-base-content/60">
                        {{ row.benchmarkReturnPct >= 0 ? '+' : '' }}{{ row.benchmarkReturnPct.toFixed(2) }}%
                      </td>
                      <td class="text-right font-mono text-sm font-semibold" :class="(row.returnPct - row.benchmarkReturnPct) >= 0 ? 'text-success' : 'text-error'">
                        {{ (row.returnPct - row.benchmarkReturnPct) >= 0 ? '+' : '' }}{{ (row.returnPct - row.benchmarkReturnPct).toFixed(2) }}%
                      </td>
                      <td class="text-center">
                        <div class="flex flex-col items-center gap-1.5">
                          <span v-if="row.isBeatingSP500" class="badge badge-success badge-sm gap-1">Beating</span>
                          <span v-else class="badge badge-error badge-sm gap-1">Trailing</span>
                          <button class="btn btn-ghost btn-xs text-[10px] text-primary" @click="openFundAttributionModal(row)">Explain</button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="benchmarkFundRows.length === 0">
                      <td colspan="6" class="text-center text-base-content/50 py-12">
                        <div class="text-2xl mb-2">🔍</div>
                        No funds found matching filters
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div v-if="lessonSuccess" class="alert alert-info">
        <span>{{ lessonSuccess }}</span>
      </div>
    </template>

    <dialog class="modal" :class="{ 'modal-open': showLessonModal }">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-1">Send Investment Lesson</h3>
        <p class="text-sm text-base-content/60 mb-4">
          Sending to: <strong>{{ lessonTargetName }}</strong>
          <span class="badge badge-sm ml-1">{{ lessonTargetType }}</span>
        </p>

        <div class="flex gap-2 mb-3">
          <input
            v-model="lessonSearch"
            type="text"
            placeholder="Search lessons..."
            class="input input-bordered input-sm flex-1"
          />
          <select v-model="lessonTypeFilter" class="select select-bordered select-sm">
            <option value="">All Categories</option>
            <option v-for="t in lessonTypes" :key="t" :value="t">{{ formatLessonType(t) }}</option>
          </select>
          <select v-model="lessonDifficultyFilter" class="select select-bordered select-sm">
            <option value="">All Levels</option>
            <option value="basic">Basic</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div class="max-h-72 overflow-y-auto border border-base-300 rounded-lg mb-4">
          <div
            v-for="lesson in filteredLessons"
            :key="lesson.id"
            class="px-3 py-2 border-b border-base-200 cursor-pointer hover:bg-base-200 transition-colors"
            :class="{ 'bg-info/10 border-info/30': selectedLessonId === lesson.id }"
            @click="selectedLessonId = selectedLessonId === lesson.id ? null : lesson.id"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium text-sm flex-1">{{ lesson.title }}</span>
              <span class="badge badge-xs" :class="lesson.difficulty === 'advanced' ? 'badge-warning' : 'badge-success'">{{ lesson.difficulty }}</span>
              <span class="badge badge-xs badge-ghost">{{ formatLessonType(lesson.lesson_type) }}</span>
            </div>
            <p class="text-xs text-base-content/50 mt-1 line-clamp-2">{{ lesson.content }}</p>
          </div>
          <div v-if="filteredLessons.length === 0" class="p-4 text-center text-base-content/50 text-sm">
            No lessons match your search.
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="showLessonModal = false">Cancel</button>
          <button class="btn btn-outline btn-info" :disabled="sendingLessonId" @click="confirmSendLesson(null)">
            <span v-if="sendingLessonId && !selectedLessonId" class="loading loading-spinner loading-xs"></span>
            Send Random Lesson
          </button>
          <button class="btn btn-info" :disabled="!selectedLessonId || sendingLessonId" @click="confirmSendLesson(selectedLessonId)">
            <span v-if="sendingLessonId && selectedLessonId" class="loading loading-spinner loading-xs"></span>
            Send Selected Lesson
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showLessonModal = false"><button>close</button></form>
    </dialog>

    <dialog class="modal" :class="{ 'modal-open': showMembersModal }">
      <div class="modal-box max-w-xl">
        <h3 class="font-bold text-lg mb-1">Member Emails</h3>
        <p class="text-sm text-base-content/60 mb-4">
          {{ selectedGroup?.name || 'Group' }} · {{ selectedGroupEmails.length }} student{{ selectedGroupEmails.length === 1 ? '' : 's' }}
        </p>

        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <span v-for="member in selectedGroup?.members || []" :key="member.id" class="badge badge-outline">
              {{ member.name || member.email || 'Student' }}
            </span>
          </div>

          <textarea
            class="textarea textarea-bordered w-full h-40 font-mono text-sm"
            readonly
            :value="selectedGroupEmailList"
          ></textarea>

          <div class="flex items-center justify-between gap-3">
            <p class="text-xs text-base-content/50">Comma-separated so you can paste directly into an email.</p>
            <button class="btn btn-sm btn-outline" :disabled="!selectedGroupEmails.length" @click="copyMemberEmails">
              {{ copiedMemberEmails ? 'Copied!' : 'Copy Emails' }}
            </button>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="showMembersModal = false">Close</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showMembersModal = false"><button>close</button></form>
    </dialog>

    <dialog class="modal" :class="{ 'modal-open': showClassContactsModal }">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-1">Class Contacts</h3>
        <p class="text-sm text-base-content/60 mb-4">
          {{ currentClass?.class_name || 'Current class' }} · {{ classContactRows.length }} student{{ classContactRows.length === 1 ? '' : 's' }}
        </p>

        <div class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <span v-for="student in classContactRows" :key="student.id" class="badge badge-outline">
              {{ student.name }}
            </span>
          </div>

          <textarea
            class="textarea textarea-bordered w-full h-48 font-mono text-sm"
            readonly
            :value="classEmailList"
          ></textarea>

          <div class="flex items-center justify-between gap-3">
            <p class="text-xs text-base-content/50">Comma-separated so you can paste directly into an email.</p>
            <button class="btn btn-sm btn-outline" :disabled="!classEmailList" @click="copyClassEmails">
              {{ copiedClassEmails ? 'Copied!' : 'Copy Emails' }}
            </button>
          </div>
        </div>

        <div class="modal-action">
          <RouterLink
            :to="{ name: 'teacher-messages', query: { class_id: currentClass?.id, recipient: 'class' } }"
            class="btn btn-primary"
            @click="showClassContactsModal = false"
          >
            Message Class
          </RouterLink>
          <button class="btn btn-ghost" @click="showClassContactsModal = false">Close</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showClassContactsModal = false"><button>close</button></form>
    </dialog>

    <dialog class="modal" :class="{ 'modal-open': showFundsModal }">
      <div class="modal-box max-w-4xl">
        <h3 class="font-bold text-lg mb-1">All Funds</h3>
        <p class="text-sm text-base-content/60 mb-4">
          {{ selectedGroup?.name || 'Group' }} · {{ selectedGroup?.fundCount || 0 }} fund{{ (selectedGroup?.fundCount || 0) === 1 ? '' : 's' }}
        </p>

        <div v-if="selectedGroup?.funds?.length" class="space-y-4">
          <div class="overflow-x-auto">
            <table class="table table-sm table-zebra">
              <thead>
                <tr>
                  <th>Fund</th>
                  <th class="text-right">Positions</th>
                  <th class="text-right">Invested</th>
                  <th class="text-right">Cash</th>
                  <th class="text-right">Value</th>
                  <th class="text-right">Return</th>
                  <th class="text-right">vs S&P 500</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="fund in selectedGroup.funds" :key="fund.id">
                  <td>
                    <div class="font-semibold">{{ formatFundName(fund) }}</div>
                    <div class="text-xs text-base-content/45">{{ fund.fund_thesis || selectedGroup.name }}</div>
                  </td>
                  <td class="text-right font-mono">{{ fund.positionsCount }}</td>
                  <td class="text-right font-mono">${{ fund.investedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                  <td class="text-right font-mono">${{ Number(fund.cash_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                  <td class="text-right font-mono font-semibold">${{ fund.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                  <td class="text-right font-mono" :class="fund.returnPct >= 0 ? 'text-success' : 'text-error'">
                    {{ fund.returnPct >= 0 ? '+' : '' }}{{ fund.returnPct.toFixed(2) }}%
                  </td>
                  <td class="text-right">
                    <div v-if="fund.benchmarkReturnPct !== undefined" class="flex items-center justify-end gap-1.5 tooltip tooltip-left" :data-tip="`S&P 500 Return: ${fund.benchmarkReturnPct.toFixed(2)}%`">
                      <span class="text-[10px] text-base-content/40 font-mono">{{ fund.benchmarkReturnPct.toFixed(1) }}%</span>
                      <span v-if="fund.isBeatingSP500" class="text-success font-bold" title="Beating S&P 500">✓</span>
                      <span v-else class="text-error font-bold" title="Trailing S&P 500">✕</span>
                    </div>
                    <div v-else class="text-xs text-base-content/20">—</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-for="fund in selectedGroup.funds" :key="`${fund.id}-positions`" class="rounded-xl border border-base-300 bg-base-100/70">
            <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-base-300">
              <div>
                <div class="font-semibold">{{ formatFundName(fund) }}</div>
                <div class="text-xs text-base-content/45">{{ fund.fund_thesis || selectedGroup.name }}</div>
              </div>
              <div class="text-right">
                <div class="text-xs text-base-content/45">Current Value</div>
                <div class="font-mono font-semibold">${{ fund.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
              </div>
            </div>

            <div v-if="fund.holdings.length === 0" class="px-4 py-4 text-sm text-base-content/45">
              No invested positions in this fund yet.
            </div>
            <div v-else class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Stock</th>
                    <th class="text-right">Shares</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Value</th>
                    <th class="text-right">Gain/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="holding in fund.holdings" :key="`${fund.id}-${holding.ticker}`">
                    <td class="py-3">
                      <div class="flex items-center gap-2.5">
                        <div class="avatar placeholder">
                          <div class="bg-base-300 text-base-content/40 rounded w-8 h-8 font-mono text-[10px] font-bold border border-base-300">
                            <span>{{ holding.ticker }}</span>
                          </div>
                        </div>
                        <div>
                          <div class="font-bold text-sm leading-tight">{{ holding.ticker }}</div>
                          <div class="text-[11px] text-base-content/60 leading-tight mt-0.5 line-clamp-1">{{ holding.companyName || '—' }}</div>
                          <div v-if="holding.sector" class="mt-1">
                            <SectorLabel :sector="holding.sector" size="xs" />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="text-right font-mono text-xs">{{ Number(holding.shares || 0).toLocaleString('en-US', { maximumFractionDigits: 4 }) }}</td>
                    <td class="text-right font-mono text-xs">${{ Number(holding.currentPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                    <td class="text-right font-mono text-xs font-semibold">${{ Number(holding.marketValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                    <td class="text-right font-mono text-xs" :class="holding.gainLoss >= 0 ? 'text-success' : 'text-error'">
                      <div class="font-semibold">{{ holding.gainLoss >= 0 ? '+' : '-' }}${{ Math.abs(Number(holding.gainLoss || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
                      <div class="text-[10px] opacity-60">{{ (holding.gainLossPct || 0) >= 0 ? '+' : '' }}{{ (holding.gainLossPct || 0).toFixed(2) }}%</div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-else class="py-8 text-center text-base-content/50">
          No funds found for this group.
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="showFundsModal = false">Close</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showFundsModal = false"><button>close</button></form>
    </dialog>

    <!-- Class Notes Modal -->
    <dialog :class="['modal', showNotesModal && 'modal-open']">
      <div class="modal-box max-w-3xl max-h-[85vh]">
        <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="closeNotesModal">X</button>
        <h3 class="font-bold text-lg flex items-center gap-2 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          Generate Class Notes
        </h3>

        <!-- Options (only show before generating) -->
        <div v-if="!classNotes" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="form-control">
              <label class="label"><span class="label-text font-medium">Start Date</span></label>
              <input type="date" v-model="notesDateStart" class="input input-bordered input-sm" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text font-medium">End Date</span></label>
              <input type="date" v-model="notesDateEnd" class="input input-bordered input-sm" />
            </div>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text font-medium">Focus on Group</span></label>
            <select v-model="notesGroupId" class="select select-bordered select-sm">
              <option value="">All Groups</option>
              <option v-for="g in teacher.groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text font-medium">Custom Instructions <span class="text-base-content/40">(optional)</span></span></label>
            <textarea v-model="notesCustomInstructions" class="textarea textarea-bordered textarea-sm" rows="2" placeholder="e.g. Focus on risk management, mention upcoming earnings..."></textarea>
          </div>

          <div class="flex gap-2 mt-2">
            <button class="btn btn-sm btn-ghost" @click="setDateRange(7)">Last 7 days</button>
            <button class="btn btn-sm btn-ghost" @click="setDateRange(14)">Last 14 days</button>
            <button class="btn btn-sm btn-ghost" @click="setDateRange(30)">Last 30 days</button>
          </div>

          <button
            class="btn btn-primary w-full"
            :disabled="generatingNotes"
            @click="generateNotes"
          >
            <span v-if="generatingNotes" class="loading loading-spinner loading-sm"></span>
            <span v-else>Generate Notes</span>
          </button>

          <p v-if="notesError" class="text-error text-sm">{{ notesError }}</p>
        </div>

        <!-- Generated Notes -->
        <div v-else class="space-y-4">
          <div class="flex items-center justify-between">
            <p class="text-sm text-base-content/60">{{ notesMeta }}</p>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-sm btn-outline" @click="copyNotes">
                {{ copied ? 'Copied!' : 'Copy' }}
              </button>
              <button class="btn btn-sm btn-outline btn-primary" @click="exportPDF">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                PDF
              </button>
              <button class="btn btn-sm btn-outline btn-secondary" @click="exportDOCX">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                DOCX
              </button>
              <button class="btn btn-sm btn-ghost" @click="classNotes = null">Regenerate</button>
            </div>
          </div>
          <div class="prose prose-sm max-w-none overflow-y-auto max-h-[55vh] bg-base-200/50 rounded-lg p-4" v-html="renderedNotes"></div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="closeNotesModal"><button>close</button></form>
    </dialog>

    <!-- Quick Messages Modal -->
    <dialog class="modal" :class="{ 'modal-open': showQuickMessageModal }">
      <div class="modal-box max-w-lg">
        <h3 class="font-bold text-lg mb-1 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Quick Messages
        </h3>
        <p class="text-sm text-base-content/60 mb-4">
          Send to: <strong>{{ quickMessageGroup?.name }}</strong>
        </p>

        <div class="space-y-2">
          <button
            v-for="(qm, idx) in quickMessages"
            :key="idx"
            class="w-full text-left border border-base-300 rounded-xl px-4 py-3 hover:bg-base-200 hover:border-primary/30 transition-all group"
            :disabled="sendingQuickMessage"
            @click="sendQuickMessage(qm)"
          >
            <div class="flex items-start gap-3">
              <span class="text-xl mt-0.5">{{ qm.icon }}</span>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm group-hover:text-primary transition-colors">{{ qm.label }}</div>
                <p class="text-xs text-base-content/50 mt-1 leading-relaxed">{{ qm.message }}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-base-content/30 group-hover:text-primary mt-1 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
          </button>
        </div>

        <div v-if="quickMessageSuccess" class="alert alert-success mt-4 py-2 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          <span>{{ quickMessageSuccess }}</span>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="showQuickMessageModal = false">Close</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="showQuickMessageModal = false"><button>close</button></form>
    </dialog>
    <GroupAttributionModal
      :group="selectedGroup"
      :isOpen="showAttributionModal"
      @close="showAttributionModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useTeacherStore } from '../../stores/teacher'
import { supabase } from '../../lib/supabase'
import { downloadPDF, downloadDOCX } from '../../lib/notesExport'
import GroupAttributionModal from '../../components/GroupAttributionModal.vue'
import SectorLabel from '../../components/SectorLabel.vue'

const route = useRoute()
const teacher = useTeacherStore()
const loading = ref(true)
const rankedGroups = ref([])
const leaderboardGroups = ref([])
const leaderboardStats = ref({ pctStudentsBeating: 0, pctGroupsBeating: 0, pctFundsBeating: 0, maxAlpha: 0, minAlpha: 0, avgAlpha: 0 })
const leaderboardLoading = ref(false)
const leaderboardError = ref('')
const sortKey = ref('returnPct')
const sortDirection = ref('desc')
const showMembersModal = ref(false)
const showFundsModal = ref(false)
const showClassContactsModal = ref(false)
const showAttributionModal = ref(false)
const selectedGroup = ref(null)
const copiedMemberEmails = ref(false)
const copiedClassEmails = ref(false)
const activeTab = ref('leaderboard')

// Benchmark Table State
const groupSearch = ref('')
const groupStatusFilter = ref('all')
const groupSortKey = ref('alpha')
const groupSortOrder = ref('desc')

const fundSearch = ref('')
const fundStatusFilter = ref('all')
const fundSortKey = ref('alpha')
const fundSortOrder = ref('desc')

const currentClass = computed(() => {
  const qid = route.query.class_id
  if (qid) {
    const match = teacher.classes.find(c => c.id === qid)
    if (match) return match
  }
  return teacher.classes[0] || null
})

function openAttributionModal(group) {
  selectedGroup.value = group
  showAttributionModal.value = true
}

function openFundAttributionModal(row) {
  // Wrap single fund in a pseudo-group for the modal
  const group = leaderboardGroups.value.find(g => g.name === row.groupName)
  const fund = group?.funds?.find(f => f.id === row.fundId)
  
  selectedGroup.value = {
    ...group,
    funds: [fund].filter(Boolean)
  }
  showAttributionModal.value = true
}

const classGroups = computed(() =>
  teacher.groups.filter(group => group.class_id === currentClass.value?.id)
)

const classStudents = computed(() =>
  teacher.students.filter(student => student.class_id === currentClass.value?.id)
)

const dashboardSummary = computed(() => {
  const groups = leaderboardGroups.value
  const totalValue = groups.reduce((sum, g) => sum + Number(g.totalValue || 0), 0)
  const totalStartingCash = groups.reduce((sum, g) => sum + Number(g.startingCash || 0), 0)
  const cash = groups.reduce((sum, g) => sum + Number(g.cash || 0), 0)
  const returnPct = totalStartingCash > 0 ? ((totalValue - totalStartingCash) / totalStartingCash) * 100 : 0
  return { totalValue, totalStartingCash, cash, returnPct }
})

const benchmarkGroupsSorted = computed(() => {
  let list = [...leaderboardGroups.value]

  // Filter
  if (groupSearch.value) {
    const q = groupSearch.value.toLowerCase()
    list = list.filter(g => g.name.toLowerCase().includes(q))
  }
  if (groupStatusFilter.value === 'beating') {
    list = list.filter(g => g.isBeatingSP500)
  } else if (groupStatusFilter.value === 'trailing') {
    list = list.filter(g => !g.isBeatingSP500)
  }

  // Sort
  list.sort((a, b) => {
    let valA = a[groupSortKey.value]
    let valB = b[groupSortKey.value]
    
    // Handle string comparison for 'name'
    if (groupSortKey.value === 'name') {
      return groupSortOrder.value === 'asc' 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA)
    }

    // Default numeric sort
    const multiplier = groupSortOrder.value === 'asc' ? 1 : -1
    return (valA - valB) * multiplier
  })

  return list
})

const benchmarkFundRows = computed(() => {
  let rows = []
  for (const group of leaderboardGroups.value) {
    for (const fund of (group.funds || [])) {
      rows.push({
        groupName: group.name,
        fundId: fund.id,
        fundName: fund.fundName || `Fund ${fund.fundNumber || 1}`,
        returnPct: fund.returnPct || 0,
        benchmarkReturnPct: fund.benchmarkReturnPct || 0,
        isBeatingSP500: fund.isBeatingSP500 || false,
        alpha: fund.alpha || 0
      })
    }
  }

  // Filter
  if (fundSearch.value) {
    const q = fundSearch.value.toLowerCase()
    rows = rows.filter(r => r.groupName.toLowerCase().includes(q) || r.fundName.toLowerCase().includes(q))
  }
  if (fundStatusFilter.value === 'beating') {
    rows = rows.filter(r => r.isBeatingSP500)
  } else if (fundStatusFilter.value === 'trailing') {
    rows = rows.filter(r => !r.isBeatingSP500)
  }

  // Sort
  rows.sort((a, b) => {
    let valA = a[fundSortKey.value]
    let valB = b[fundSortKey.value]

    if (fundSortKey.value === 'groupName' || fundSortKey.value === 'fundName') {
      return fundSortOrder.value === 'asc' 
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA)
    }

    const multiplier = fundSortOrder.value === 'asc' ? 1 : -1
    return (valA - valB) * multiplier
  })

  return rows
})

function toggleGroupSort(key) {
  if (groupSortKey.value === key) {
    groupSortOrder.value = groupSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    groupSortKey.value = key
    groupSortOrder.value = 'desc'
  }
}

function toggleFundSort(key) {
  if (fundSortKey.value === key) {
    fundSortOrder.value = fundSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    fundSortKey.value = key
    fundSortOrder.value = 'desc'
  }
}

function getSortIcon(key, currentKey, currentOrder) {
  if (currentKey !== key) return '↕'
  return currentOrder === 'asc' ? '↑' : '↓'
}

const selectedGroupEmails = computed(() =>
  (selectedGroup.value?.members || [])
    .map(member => member.email?.trim())
    .filter(Boolean)
)

const selectedGroupEmailList = computed(() => selectedGroupEmails.value.join(', '))

const classContactRows = computed(() =>
  classStudents.value
    .map(student => ({
      id: student.id || student.user_id,
      name: student.name || student.email || 'Student',
      email: student.email?.trim() || ''
    }))
    .filter(student => student.email)
    .sort((a, b) => a.name.localeCompare(b.name))
)

const classEmailList = computed(() => classContactRows.value.map(student => student.email).join(', '))

const sortedGroups = computed(() => {
  const groups = [...rankedGroups.value]

  groups.sort((a, b) => {
    let comparison = 0

    if (sortKey.value === 'rank') {
      comparison = Number(b.returnPct || 0) - Number(a.returnPct || 0)
    } else if (sortKey.value === 'name') {
      comparison = (a.name || '').localeCompare(b.name || '')
    } else if (sortKey.value === 'members') {
      comparison = Number(a.members?.length || 0) - Number(b.members?.length || 0)
    } else if (sortKey.value === 'lastTradeAt') {
      comparison = new Date(a.lastTradeAt || 0).getTime() - new Date(b.lastTradeAt || 0).getTime()
    } else {
      comparison = Number(a[sortKey.value] || 0) - Number(b[sortKey.value] || 0)
    }

    return sortDirection.value === 'asc' ? comparison : -comparison
  })

  return groups
})

const sendingLessonId = ref(null)
const lessonSuccess = ref('')
const showLessonModal = ref(false)
const allLessons = ref([])
const lessonSearch = ref('')
const lessonTypeFilter = ref('')
const lessonDifficultyFilter = ref('')
const selectedLessonId = ref(null)
const lessonTargetId = ref(null)
const lessonTargetType = ref('')
const lessonTargetName = ref('')

const lessonTypes = computed(() => {
  const types = new Set(allLessons.value.map(l => l.lesson_type))
  return [...types].sort()
})

const filteredLessons = computed(() => {
  let result = allLessons.value
  if (lessonTypeFilter.value) result = result.filter(l => l.lesson_type === lessonTypeFilter.value)
  if (lessonDifficultyFilter.value) result = result.filter(l => l.difficulty === lessonDifficultyFilter.value)
  if (lessonSearch.value) {
    const q = lessonSearch.value.toLowerCase()
    result = result.filter(l => l.title.toLowerCase().includes(q) || l.content.toLowerCase().includes(q))
  }
  return result
})

// Quick Messages state
const showQuickMessageModal = ref(false)
const quickMessageGroup = ref(null)
const sendingQuickMessage = ref(false)
const quickMessageSuccess = ref('')

const quickMessages = [
  {
    icon: '💰',
    label: 'Remind to Invest',
    message: 'Hey team! We noticed you still have uninvested cash sitting in your fund. Remember — cash earns nothing. Research some stocks and put that money to work!'
  },
  {
    icon: '📊',
    label: 'Review Your Portfolio',
    message: 'Time for a portfolio check-in! Take a few minutes to review your holdings. Are your stocks performing the way you expected? Any changes you want to make?'
  },
  {
    icon: '🔍',
    label: 'Do Your Research',
    message: 'Before making your next trade, make sure you do your homework. Look at the company\'s fundamentals, recent news, and earnings. Smart investors research first!'
  },
  {
    icon: '🏆',
    label: 'Great Job!',
    message: 'Your team is doing awesome work! Keep up the great investing strategy. Stay focused, stay disciplined, and keep learning from every trade.'
  },
  {
    icon: '📈',
    label: 'Check the Market',
    message: 'Have you looked at the market today? Check what\'s moving and think about how current events might affect your portfolio. Stay informed!'
  },
  {
    icon: '🤝',
    label: 'Discuss as a Team',
    message: 'Reminder: the best investment decisions come from teamwork. Get together with your group, share your ideas, and make a plan before your next trade.'
  }
]

function openQuickMessageModal(group) {
  quickMessageGroup.value = group
  quickMessageSuccess.value = ''
  showQuickMessageModal.value = true
}

async function sendQuickMessage(qm) {
  if (!quickMessageGroup.value || !currentClass.value) return
  sendingQuickMessage.value = true
  quickMessageSuccess.value = ''

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { sendingQuickMessage.value = false; return }

  await supabase.from('messages').insert({
    class_id: currentClass.value.id,
    sender_id: session.user.id,
    recipient_type: 'group',
    recipient_id: quickMessageGroup.value.id,
    content: qm.message
  })

  quickMessageSuccess.value = `"${qm.label}" sent to ${quickMessageGroup.value.name}!`
  sendingQuickMessage.value = false
  setTimeout(() => { quickMessageSuccess.value = '' }, 3000)
}

// Class Notes state
const showNotesModal = ref(false)
const generatingNotes = ref(false)
const classNotes = ref(null)
const notesMeta = ref('')
const notesError = ref('')
const copied = ref(false)

// Default: last 7 days
const today = new Date()
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
const notesDateStart = ref(sevenDaysAgo.toISOString().split('T')[0])
const notesDateEnd = ref(today.toISOString().split('T')[0])
const notesGroupId = ref('')
const notesCustomInstructions = ref('')

function setDateRange(days) {
  const end = new Date()
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  notesDateStart.value = start.toISOString().split('T')[0]
  notesDateEnd.value = end.toISOString().split('T')[0]
}

function formatTradeDate(value) {
  if (!value) return 'No trades yet'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTradeDateCompact(value) {
  if (!value) return '--'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit'
  })
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 0
  })
}

function formatFundName(fund) {
  return fund?.fund_name || `Fund ${fund?.fund_number || 1}`
}

function setSort(key) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }

  sortKey.value = key
  sortDirection.value = key === 'name' || key === 'members' ? 'asc' : 'desc'
}

function sortIndicator(key) {
  if (sortKey.value !== key) return ''
  return sortDirection.value === 'asc' ? '↑' : '↓'
}

function openMemberModal(group) {
  selectedGroup.value = group
  copiedMemberEmails.value = false
  showMembersModal.value = true
}

function openFundsModal(group) {
  selectedGroup.value = group
  showFundsModal.value = true
}

function openClassContactsModal() {
  copiedClassEmails.value = false
  showClassContactsModal.value = true
}

function copyMemberEmails() {
  if (!selectedGroupEmailList.value) return
  navigator.clipboard.writeText(selectedGroupEmailList.value)
  copiedMemberEmails.value = true
  setTimeout(() => { copiedMemberEmails.value = false }, 2000)
}

function copyClassEmails() {
  if (!classEmailList.value) return
  navigator.clipboard.writeText(classEmailList.value)
  copiedClassEmails.value = true
  setTimeout(() => { copiedClassEmails.value = false }, 2000)
}

function formatLessonType(type) {
  return type.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

async function loadLessons() {
  if (allLessons.value.length > 0) return
  const { data } = await supabase.from('investment_lessons').select('*').order('lesson_type').order('title')
  allLessons.value = data || []
}

function openLessonModal(ownerId, ownerType, name) {
  lessonTargetId.value = ownerId
  lessonTargetType.value = ownerType
  lessonTargetName.value = name
  selectedLessonId.value = null
  lessonSearch.value = ''
  lessonTypeFilter.value = ''
  lessonDifficultyFilter.value = ''
  loadLessons()
  showLessonModal.value = true
}

async function confirmSendLesson(lessonId) {
  sendingLessonId.value = lessonTargetId.value
  lessonSuccess.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const body = { owner_id: lessonTargetId.value, owner_type: lessonTargetType.value }
    if (lessonId) body.lesson_id = lessonId
    const res = await fetch('/api/send-lesson', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    })
    const result = await res.json()
    if (res.ok) {
      lessonSuccess.value = `Lesson sent to ${lessonTargetName.value}: \"${result.lesson_title}\" (${result.difficulty})`
      showLessonModal.value = false
    } else {
      lessonSuccess.value = `Error: ${result.error || 'Failed to send lesson'}`
    }
    setTimeout(() => { lessonSuccess.value = '' }, 5000)
  } finally {
    sendingLessonId.value = null
  }
}

function closeNotesModal() {
  showNotesModal.value = false
  // Don't clear notes so user can re-open and see them
}

async function generateNotes() {
  if (!currentClass.value) return
  generatingNotes.value = true
  notesError.value = ''
  classNotes.value = null

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { notesError.value = 'Not logged in'; generatingNotes.value = false; return }

  try {
    const body = {
      class_id: currentClass.value.id,
      date_start: new Date(notesDateStart.value).toISOString(),
      date_end: new Date(notesDateEnd.value + 'T23:59:59').toISOString()
    }
    if (notesGroupId.value) body.group_id = notesGroupId.value
    if (notesCustomInstructions.value.trim()) body.custom_instructions = notesCustomInstructions.value.trim()

    const res = await fetch('/api/generate-class-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      notesError.value = data.error || 'Failed to generate notes'
    } else {
      // Stream the response
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      classNotes.value = ''
      notesMeta.value = `${res.headers.get('X-Notes-Period') || ''} | ${res.headers.get('X-Notes-Groups') || '?'} groups | ${res.headers.get('X-Notes-Tickers') || '?'} stocks tracked`
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        classNotes.value += decoder.decode(value, { stream: true })
      }
    }
  } catch (err) {
    notesError.value = 'Server error — the request may have timed out. Try a shorter date range or a single group.'
  }

  generatingNotes.value = false
}

function copyNotes() {
  if (classNotes.value) {
    navigator.clipboard.writeText(classNotes.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
}

function exportPDF() {
  if (classNotes.value) downloadPDF(classNotes.value, notesMeta.value)
}

function exportDOCX() {
  if (classNotes.value) downloadDOCX(classNotes.value, notesMeta.value)
}

// Simple markdown to HTML renderer
const renderedNotes = computed(() => {
  if (!classNotes.value) return ''
  return classNotes.value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
})

async function loadDashboard() {
  if (!teacher.classes.length || (route.query.class_id && !currentClass.value)) {
    rankedGroups.value = []
    leaderboardGroups.value = []
    loading.value = false
    return
  }

  loading.value = true
  leaderboardLoading.value = true
  leaderboardError.value = ''
  try {
    // Load leaderboard from server-side API (computes market values server-side)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token && currentClass.value?.id) {
      const res = await fetch('/api/teacher-leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ class_id: currentClass.value.id })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.groups) {
        leaderboardGroups.value = data.groups
        if (data.stats) leaderboardStats.value = data.stats
      } else {
        leaderboardError.value = data.error || 'Failed to load leaderboard'
      }
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err)
    leaderboardError.value = 'Failed to load leaderboard'
  } finally {
    loading.value = false
    leaderboardLoading.value = false
  }
}

onMounted(async () => {
  await teacher.loadTeacherData()
  await loadDashboard()
})

watch(
  () => currentClass.value?.id,
  async (newId, oldId) => {
    if (newId === oldId) return
    await loadDashboard()
  }
)
</script>
