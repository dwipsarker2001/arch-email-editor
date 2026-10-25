<template>
  <div ref="containerRef" :style="{ width: '100%', height: '100%', minHeight: '600px' }"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { ArchEmailEditor } from '../../src/editor';
import type { EmailDocument, PrebuiltSection, ToolbarCustomButton } from '../../src/types';

const props = withDefaults(defineProps<{
  initialData?: EmailDocument;
  theme?: 'light' | 'dark';
  readOnly?: boolean;
  templateName?: string;
  editableTemplateName?: boolean;
  customButtons?: ToolbarCustomButton[];
  sections?: PrebuiltSection[];
  customSections?: PrebuiltSection[];
}>(), {
  theme: 'light',
  readOnly: false,
  editableTemplateName: true
});

const emit = defineEmits<{
  (e: 'change', doc: EmailDocument): void;
  (e: 'select', block: any): void;
  (e: 'templateNameChange', name: string): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let editorInstance: ArchEmailEditor | null = null;

onMounted(() => {
  if (!containerRef.value) return;
  editorInstance = ArchEmailEditor.create(containerRef.value, {
    initialData: props.initialData,
    theme: props.theme,
    readOnly: props.readOnly,
    templateName: props.templateName,
    editableTemplateName: props.editableTemplateName,
    customButtons: props.customButtons,
    sections: props.sections,
    customSections: props.customSections,
    onTemplateNameChange: (name) => emit('templateNameChange', name),
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
  addCustomButton: (button: ToolbarCustomButton) => editorInstance?.addCustomButton(button),
  removeCustomButton: (id: string) => editorInstance?.removeCustomButton(id),
  getSections: () => editorInstance?.getSections() ?? [],
  getSectionById: (id: string) => editorInstance?.getSectionById(id),
  setSections: (sections: PrebuiltSection[]) => editorInstance?.setSections(sections),
  addSection: (section: PrebuiltSection) => editorInstance?.addSection(section),
  removeSection: (id: string) => editorInstance?.removeSection(id),
  getEditor: () => editorInstance
});
</script>
