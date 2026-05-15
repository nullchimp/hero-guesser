<template>
  <main class="app-shell">
    <section
      class="workspace"
      aria-labelledby="app-title"
    >
      <header class="topbar">
        <div class="brand">
          <span
            class="brand-mark"
            aria-hidden="true"
          >HG</span>
          <div>
            <h1 id="app-title">
              Hero Guesser
            </h1>
            <p>{{ ownerLabel }}</p>
          </div>
        </div>

        <div class="topbar-actions">
          <label class="model-picker">
            <span>Model for new games</span>
            <select
              v-model="selectedModel"
              :disabled="isBusy"
            >
              <option
                v-for="model in models"
                :key="model.id"
                :value="model.id"
              >
                {{ model.label }}
              </option>
            </select>
          </label>
          <button
            class="primary-action"
            type="button"
            :disabled="!canStartGame"
            @click="startGame"
          >
            New Game
          </button>
        </div>
      </header>

      <div class="game-layout">
        <aside
          class="sidebar"
          aria-label="Saved sessions"
        >
          <div class="panel-heading">
            <h2>Sessions</h2>
            <span>{{ sessions.length }}</span>
          </div>
          <p
            v-if="sessions.length === 0"
            class="empty-line"
          >
            No saved games yet.
          </p>
          <article
            v-for="session in sessions"
            :key="session.sessionId"
            class="session-card"
            :class="{ 'session-card--active': session.sessionId === activeSession?.sessionId }"
          >
            <button
              class="session-main"
              type="button"
              :disabled="isBusy"
              :aria-label="`Open session ${session.sessionId}`"
              @click="selectSession(session.sessionId)"
            >
              <span class="session-model">{{ session.model }}</span>
              <span class="session-status">
                <strong>{{ formatStatus(session.status) }}</strong>
                <small>{{ session.questionsAsked }}/{{ session.maxQuestions }} questions</small>
              </span>
              <small v-if="session.pendingGuessName">Guess: {{ session.pendingGuessName }}</small>
              <small v-else-if="session.lastMessage">{{ session.lastMessage }}</small>
            </button>
            <div class="session-actions">
              <button
                class="session-delete-action"
                type="button"
                :disabled="isBusy"
                title="Delete session"
                :aria-label="`Delete session ${session.sessionId}`"
                @click="deleteSavedSession(session.sessionId)"
              >
                <span
                  class="trash-icon"
                  aria-hidden="true"
                />
              </button>
            </div>
          </article>
        </aside>

        <section
          class="play-area"
          aria-live="polite"
        >
          <p
            v-if="errorMessage"
            class="error-line"
            role="alert"
          >
            {{ errorMessage }}
          </p>

          <div
            v-if="isLoading"
            class="state-block"
          >
            Loading games...
          </div>

          <div
            v-else-if="activeSession === null"
            class="state-block"
          >
            Think of a hero or villain, choose a model, and start a game.
          </div>

          <template v-else>
            <header class="session-header">
              <div>
                <p class="eyebrow">
                  {{ activeSession.model }}
                </p>
                <h2>{{ formatStatus(activeSession.status) }}</h2>
              </div>
              <div class="question-meter">
                <span>{{ activeSession.questionsAsked }}</span>
                <small>of {{ activeSession.maxQuestions }} questions</small>
              </div>
            </header>

            <section
              ref="messagesPanel"
              class="messages"
              aria-label="Game history"
            >
              <article
                v-for="entry in transcript"
                :key="entry.message.id"
                class="message"
                :class="[
                  `message--${entry.message.role}`,
                  `message--${entry.message.kind}`,
                  { 'message--answered': entry.attachedAnswer !== null }
                ]"
              >
                <div class="message-meta">
                  <span>{{ messageLabel(entry.message) }}</span>
                  <time :datetime="entry.message.createdAt">{{ formatTime(entry.message.createdAt) }}</time>
                </div>

                <template v-if="entry.message.kind === 'guess' && entry.message.guess !== null">
                  <div class="guess-card">
                    <img
                      :src="entry.message.guess.imageUrl"
                      :alt="entry.message.guess.articleTitle"
                      @load="scrollMessagesToBottom"
                    >
                    <div class="guess-body">
                      <div class="guess-title">
                        <h3>{{ entry.message.guess.name }}</h3>
                        <span>{{ entry.message.guess.confidence }} confidence</span>
                      </div>
                      <p>{{ entry.message.guess.rationale }}</p>
                      <p>{{ entry.message.guess.articleExtract }}</p>
                      <a
                        :href="entry.message.guess.articleUrl"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {{ entry.message.guess.articleTitle }} on Wikipedia
                      </a>
                      <div
                        v-if="entry.message.guess.status === 'pending' && activeSession.status === 'active'"
                        class="judgment-actions"
                      >
                        <button
                          class="judgment-button judgment-button--correct"
                          type="button"
                          :disabled="isBusy"
                          @click="judge(entry.message.guess.id, 'correct')"
                        >
                          Correct
                        </button>
                        <button
                          class="judgment-button judgment-button--wrong"
                          type="button"
                          :disabled="isBusy"
                          @click="judge(entry.message.guess.id, 'wrong')"
                        >
                          Wrong
                        </button>
                      </div>
                      <small v-else>Marked {{ entry.message.guess.status }}</small>
                    </div>
                  </div>
                </template>

                <p v-else>
                  {{ entry.message.content }}
                </p>
                <p
                  v-if="entry.attachedAnswer !== null"
                  class="answer-inline"
                  :aria-label="`You answered ${entry.attachedAnswer.content}`"
                >
                  {{ formatAnswer(entry.attachedAnswer.content) }}
                </p>
              </article>
            </section>

            <div
              v-if="showAnswerBar"
              class="answer-bar"
            >
              <template v-if="isBusy">
                <p role="status">
                  Thinking...
                </p>
              </template>
              <template v-else-if="canAnswer">
                <button
                  class="answer-button answer-button--yes"
                  type="button"
                  @click="answer('yes')"
                >
                  Yes
                </button>
                <button
                  class="answer-button answer-button--no"
                  type="button"
                  @click="answer('no')"
                >
                  No
                </button>
                <button
                  class="answer-button answer-button--unknown"
                  type="button"
                  @click="answer('unknown')"
                >
                  Unknown
                </button>
              </template>
              <p
                v-else-if="pendingGuess"
                role="status"
              >
                Judge the current guess.
              </p>
              <p
                v-else
                role="status"
              >
                {{ completionText }}
              </p>
            </div>
          </template>
        </section>

        <aside
          class="leaderboard"
          aria-label="Model leaderboard"
        >
          <div class="panel-heading">
            <h2>Leaderboard</h2>
            <span>{{ leaderboard.length }}</span>
          </div>
          <p
            v-if="leaderboard.length === 0"
            class="empty-line"
          >
            Completed games will appear here.
          </p>
          <table v-else>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Model</th>
                <th>Win</th>
                <th>Avg</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in leaderboard"
                :key="entry.model"
              >
                <td>{{ entry.rank }}</td>
                <td>{{ entry.model }}</td>
                <td>{{ formatPercent(entry.winRate) }}</td>
                <td>{{ formatAverage(entry.averageQuestionsToWin) }}</td>
              </tr>
            </tbody>
          </table>
        </aside>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  ConversationMessage,
  GameSession,
  GuessVerdict,
  LeaderboardEntry,
  ModelOption,
  PlayerAnswer,
  SessionSummary,
  createSession,
  deleteSession,
  fetchLeaderboard,
  fetchModels,
  fetchSession,
  fetchSessions,
  getOwnerId,
  judgeGuess,
  submitAnswer
} from "./services/api";

const ownerId = getOwnerId();
const models = ref<ModelOption[]>([]);
const selectedModel = ref("");
const sessions = ref<SessionSummary[]>([]);
const activeSession = ref<GameSession | null>(null);
const leaderboard = ref<LeaderboardEntry[]>([]);
const isLoading = ref(true);
const isBusy = ref(false);
const errorMessage = ref("");
const messagesPanel = ref<HTMLElement | null>(null);

interface TranscriptEntry {
  attachedAnswer: ConversationMessage | null;
  message: ConversationMessage;
}

const ownerLabel = computed(() => `Player ${ownerId.slice(0, 8)}`);
const canStartGame = computed(() => selectedModel.value.length > 0 && !isLoading.value && !isBusy.value);
const pendingGuess = computed(() => activeSession.value?.messages.find(
  (message) => message.guess?.status === "pending"
)?.guess ?? null);
const transcript = computed<TranscriptEntry[]>(() => {
  const messages = activeSession.value?.messages ?? [];

  return messages.flatMap((message, index) => {
    if (message.kind === "answer" && messages[index - 1]?.kind === "question") {
      return [];
    }

    return [
      {
        attachedAnswer: message.kind === "question" && messages[index + 1]?.kind === "answer"
          ? messages[index + 1]
          : null,
        message
      }
    ];
  });
});
const canAnswer = computed(() => {
  if (activeSession.value === null || activeSession.value.status !== "active" || pendingGuess.value !== null) {
    return false;
  }

  return activeSession.value.messages.at(-1)?.kind === "question";
});
const showAnswerBar = computed(() => isBusy.value || canAnswer.value || pendingGuess.value === null);
const completionText = computed(() => {
  if (activeSession.value?.status === "won") {
    return "The model won this round.";
  }

  if (activeSession.value?.status === "lost") {
    return "The model ran out of guesses.";
  }

  return "Waiting for the next move.";
});

onMounted(async () => {
  try {
    const [modelResponse, sessionResponse, leaderboardResponse] = await Promise.all([
      fetchModels(ownerId),
      fetchSessions(ownerId),
      fetchLeaderboard(ownerId)
    ]);

    models.value = modelResponse.models;
    selectedModel.value = modelResponse.defaultModel;
    sessions.value = sessionResponse.sessions;
    leaderboard.value = leaderboardResponse.leaderboard;

    if (sessions.value.length > 0) {
      activeSession.value = await fetchSession(ownerId, sessions.value[0].sessionId);
    }
  } catch (error) {
    errorMessage.value = toErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
});

watch(
  activeSession,
  async () => {
    await nextTick();
    scrollMessagesToBottom();
  },
  { deep: true }
);

async function startGame(): Promise<void> {
  await runAction(async () => {
    activeSession.value = await createSession(ownerId, selectedModel.value);
    await refreshLists();
  });
}

async function selectSession(sessionId: string): Promise<void> {
  await runAction(async () => {
    activeSession.value = await fetchSession(ownerId, sessionId);
  });
}

async function deleteSavedSession(sessionId: string): Promise<void> {
  await runAction(async () => {
    const deletedActiveSession = activeSession.value?.sessionId === sessionId;

    await deleteSession(ownerId, sessionId);
    await refreshLists();

    if (deletedActiveSession) {
      activeSession.value = null;

      if (sessions.value.length > 0) {
        activeSession.value = await fetchSession(ownerId, sessions.value[0].sessionId);
      }
    }
  });
}

function scrollMessagesToBottom(): void {
  const panel = messagesPanel.value;

  if (panel === null) {
    return;
  }

  panel.scrollTop = panel.scrollHeight;

  const scheduleFrame = globalThis.requestAnimationFrame ?? ((callback: FrameRequestCallback) => {
    globalThis.setTimeout(() => callback(Date.now()), 0);
    return 0;
  });

  scheduleFrame(() => {
    panel.scrollTop = panel.scrollHeight;
  });
}

async function answer(value: PlayerAnswer): Promise<void> {
  const sessionId = activeSession.value?.sessionId;

  if (sessionId === undefined) {
    return;
  }

  await runAction(async () => {
    activeSession.value = await submitAnswer(ownerId, sessionId, value);
    await refreshLists();
  });
}

async function judge(guessId: string, verdict: GuessVerdict): Promise<void> {
  const sessionId = activeSession.value?.sessionId;

  if (sessionId === undefined) {
    return;
  }

  await runAction(async () => {
    activeSession.value = await judgeGuess(ownerId, sessionId, guessId, verdict);
    await refreshLists();
  });
}

async function refreshLists(): Promise<void> {
  const [sessionResponse, leaderboardResponse] = await Promise.all([
    fetchSessions(ownerId),
    fetchLeaderboard(ownerId)
  ]);

  sessions.value = sessionResponse.sessions;
  leaderboard.value = leaderboardResponse.leaderboard;
}

async function runAction(action: () => Promise<void>): Promise<void> {
  errorMessage.value = "";
  isBusy.value = true;

  try {
    await action();
  } catch (error) {
    errorMessage.value = toErrorMessage(error);
  } finally {
    isBusy.value = false;
  }
}

function messageLabel(message: ConversationMessage): string {
  if (message.kind === "answer") {
    return "You";
  }

  if (message.kind === "guess") {
    return "Guess";
  }

  return "Hero Guesser";
}

function formatStatus(status: string): string {
  if (status === "won") {
    return "Won";
  }

  if (status === "lost") {
    return "Lost";
  }

  return "Active";
}

function formatAnswer(value: string): string {
  if (value === "yes") {
    return "Yes";
  }

  if (value === "no") {
    return "No";
  }

  if (value === "unknown") {
    return "Unknown";
  }

  return value;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
    style: "percent"
  }).format(value);
}

function formatAverage(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1
  }).format(value);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}
</script>
