<template>
  <div ref="containerRef" :style="{ width: '100%', height: '100%', minHeight: '600px' }"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { ArchEmailEditor } from '../../src/editor';
import type { EmailDocument } from '../../src/types';

const props = withDefaults(defineProps<{
  initialData?: EmailDocument;
  theme?: 'light' | 'dark';
  readOnly?: boolean;
}>(), {
  theme: 'light',
  readOnly: false
});

const emit = defineEmits<{
  (e: 'change', doc: EmailDocument): void;
  (e: 'select', block: any): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let editorInstance: ArchEmailEditor | null = null;

onMounted(() => {
  if (!containerRef.value) return;
  editorInstance = ArchEmailEditor.create(containerRef.value, {
    initialData: props.initialData,
    theme: props.theme,
    readOnly: props.readOnly,
    onChange: (doc) => emit('change', doc),
    onSelectBlock: (block) => emit('select', block)
  });
});

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.destroy();
    editorInstance = null;
  }
});

defineExpose({
  getJSON: () => editorInstance?.getJSON() ?? null,
  getHTML: () => editorInstance?.getHTML() ?? '',
  setHTML: (html: string) => editorInstance?.setHTML(html),
  loadHTML: (html: string) => editorInstance?.loadHTML(html),
  insertHTML: (html: string, options?: any) => editorInstance?.insertHTML(html, options),
  setTemplateName: (name: string) => editorInstance?.setTemplateName(name),
  getTemplateName: () => editorInstance?.getTemplateName() ?? '',
  addCustomButton: (button: any) => editorInstance?.addCustomButton(button),
  removeCustomButton: (id: string) => editorInstance?.removeCustomButton(id),
  getEditor: () => editorInstance
});
</script>
