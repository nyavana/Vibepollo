<template>
  <n-button
    v-if="visible"
    type="default"
    strong
    size="small"
    class="flex items-center gap-2 text-xs select-none n-button--linkish"
    :class="{ 'cursor-pointer': canSave }"
    :title="tooltip"
    @click="onClick"
  >
    <i :class="iconClass" />
    <span class="opacity-80">{{ label }}</span>
  </n-button>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useConfigStore } from '@/stores/config';
import { storeToRefs } from 'pinia';
import { NButton, useMessage } from 'naive-ui';
import { http } from '@/http';

const route = useRoute();
const { t } = useI18n();
const store = useConfigStore();
const { savingState, manualDirty, validationError } = storeToRefs(store);
const message = useMessage();
const hasPending = computed(() => store.hasPendingPatch());
const restartRequired = computed(
  () => !!(store.lastSaveResult && store.lastSaveResult.restartRequired),
);
const intervalMs = computed(() => store.autosaveIntervalMs || 3000);
const nowMs = ref(Date.now());
const nextAt = computed(() => store.nextAutosaveAt());
const countdown = computed(() => {
  if (!hasPending.value) return 0;
  const ms = Math.max(0, nextAt.value - nowMs.value);
  return Math.ceil(ms / 1000);
});

let timer: any = null;
onMounted(() => {
  timer = setInterval(() => (nowMs.value = Date.now()), 250);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const visible = computed(() => route.path === '/settings');
const canSave = computed(
  () =>
    visible.value &&
    (savingState.value === 'error' ||
      manualDirty.value === true ||
      hasPending.value === true ||
      (savingState.value === 'saved' && restartRequired.value === true)),
);

const label = computed(() => {
  if (hasPending.value) {
    return t('settings.save_status.auto_save_in', { seconds: countdown.value });
  }
  switch (savingState.value) {
    case 'saving':
      return t('settings.save_status.saving');
    case 'dirty':
      return manualDirty.value
        ? t('settings.save_status.unsaved_click')
        : t('settings.save_status.unsaved');
    case 'saved':
      return restartRequired.value
        ? t('settings.save_status.saved_restart')
        : t('settings.save_status.saved');
    case 'error':
      return t('settings.save_status.error_retry');
    default:
      return t('settings.save_status.waiting');
  }
});

const iconClass = computed(() => {
  const base = 'fas text-[11px]';
  if (hasPending.value) return base + ' fa-clock text-warning';
  switch (savingState.value) {
    case 'saving':
      return base + ' fa-spinner animate-spin opacity-80';
    case 'dirty':
      return base + ' fa-circle-exclamation text-warning';
    case 'saved':
      return restartRequired.value
        ? base + ' fa-power-off text-secondary'
        : base + ' fa-check text-success';
    case 'error':
      return base + ' fa-triangle-exclamation text-danger';
    default:
      return base + ' fa-circle opacity-60 pulse-soft';
  }
});

const tooltip = computed(() => {
  if (savingState.value === 'error' && validationError.value) return validationError.value;
  if (hasPending.value)
    return t('settings.save_status.auto_save_tooltip', {
      seconds: Math.round(intervalMs.value / 1000),
    });
  if (restartRequired.value)
    return t('settings.save_status.restart_tooltip');
  return t('settings.save_status.auto_save_hint');
});

async function onClick() {
  if (!canSave.value) return;
  try {
    if (restartRequired.value && savingState.value === 'saved') {
      await http.post(
        '/api/restart',
        {},
        { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true },
      );
      return;
    }
    if (hasPending.value) {
      const ok = await store.flushPatchQueue();
      if (!ok) {
        try {
          message.error(validationError.value || t('settings.save_status.save_failed'), {
            duration: 5000,
          });
        } catch {}
      }
      return;
    }
    const ok = await store.save();
    if (!ok) {
      try {
        message.error(validationError.value || t('settings.save_status.save_failed'), {
          duration: 5000,
        });
      } catch {}
    }
  } catch {}
}
</script>

<style scoped>
@keyframes pulseSoft {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.06);
  }
}
.pulse-soft {
  animation: pulseSoft 1.6s ease-in-out infinite;
}
</style>
