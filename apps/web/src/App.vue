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
            <p>{{ sessionLabel }}</p>
          </div>
        </div>

        <label class="model-picker">
          <span>Model</span>
          <select
            v-model="selectedModel"
            :disabled="isLoading || isSending"
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
      </header>

      <section
        class="conversation"
        aria-live="polite"
        aria-label="Conversation history"
      >
        <p
          v-if="isLoading"
          class="state-line"
        >
          Loading conversation...
        </p>
        <p
          v-else-if="messages.length === 0"
          class="state-line"
        >
          Ready for a clue.
        </p>

        <article
          v-for="message in messages"
          :key="message.id"
          class="message"
          :class="[`message--${message.role}`, `message--${message.status}`]"
        >
          <div class="message-meta">
            <span>{{ message.role === "user" ? "You" : "Hero Guesser" }}</span>
            <time :datetime="message.createdAt">{{ formatTime(message.createdAt) }}</time>
          </div>
          <p>{{ message.content || "Thinking..." }}</p>
          <small v-if="message.errorMessage">{{ message.errorMessage }}</small>
        </article>

        <div
          ref="messagesEnd"
          aria-hidden="true"
        />
      </section>

      <form
        class="composer"
        @submit.prevent="submitMessage"
      >
        <label for="clue">Clue</label>
        <textarea
          id="clue"
          v-model="draft"
          :disabled="isLoading || isSending"
          maxlength="4000"
          placeholder="Billionaire detective in a cape"
          rows="3"
          @keydown.enter.exact.prevent="submitMessage"
        />
        <div class="composer-actions">
          <p role="status">
            {{ statusText }}
          </p>
          <button
            type="submit"
            :disabled="!canSubmit"
          >
            Guess
          </button>
        </div>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import {
  ConversationMessage,
  ModelOption,
  StreamEvent,
  fetchConversation,
  fetchModels,
  getSessionId,
  sendMessageStream
} from "./services/api";

const sessionId = getSessionId();
const models = ref<ModelOption[]>([]);
const selectedModel = ref("");
const messages = ref<ConversationMessage[]>([]);
const draft = ref("");
const isLoading = ref(true);
const isSending = ref(false);
const errorMessage = ref("");
const messagesEnd = ref<HTMLDivElement | null>(null);

const sessionLabel = computed(() => `Session ${sessionId.slice(0, 8)}`);
const canSubmit = computed(() => draft.value.trim().length > 0 && !isLoading.value && !isSending.value);
const statusText = computed(() => {
  if (errorMessage.value.length > 0) {
    return errorMessage.value;
  }

  if (isSending.value) {
    return "Guessing...";
  }

  return `${messages.value.length} saved messages`;
});

onMounted(async () => {
  try {
    const [modelResponse, conversation] = await Promise.all([
      fetchModels(sessionId),
      fetchConversation(sessionId)
    ]);

    models.value = modelResponse.models;
    selectedModel.value = conversation.model || modelResponse.defaultModel;
    messages.value = conversation.messages;
  } catch (error) {
    errorMessage.value = toErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
});

watch(
  messages,
  async () => {
    await nextTick();
    messagesEnd.value?.scrollIntoView({ behavior: "smooth", block: "end" });
  },
  { deep: true }
);

async function submitMessage(): Promise<void> {
  if (!canSubmit.value) {
    return;
  }

  const content = draft.value.trim();
  draft.value = "";
  errorMessage.value = "";
  isSending.value = true;

  try {
    await sendMessageStream(sessionId, content, selectedModel.value, handleStreamEvent);
  } catch (error) {
    errorMessage.value = toErrorMessage(error);
  } finally {
    isSending.value = false;
  }
}

function handleStreamEvent(event: StreamEvent): void {
  if (event.type === "user-message" || event.type === "assistant-message-start") {
    upsertMessage(event.message);
    return;
  }

  if (event.type === "assistant-delta") {
    appendAssistantDelta(event.content);
    return;
  }

  if (event.type === "assistant-message-complete") {
    upsertMessage(event.message);
    return;
  }

  if (event.type === "error") {
    errorMessage.value = event.error;

    if (event.message !== undefined) {
      upsertMessage(event.message);
    }
  }
}

function upsertMessage(message: ConversationMessage): void {
  const index = messages.value.findIndex((candidate) => candidate.id === message.id);

  if (index === -1) {
    messages.value = [...messages.value, message];
    return;
  }

  messages.value = [
    ...messages.value.slice(0, index),
    message,
    ...messages.value.slice(index + 1)
  ];
}

function appendAssistantDelta(content: string): void {
  const lastAssistant = [...messages.value].reverse().find((message) => message.role === "assistant");

  if (lastAssistant === undefined) {
    return;
  }

  upsertMessage({
    ...lastAssistant,
    content: `${lastAssistant.content}${content}`
  });
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}
</script>
