/**
 * Arch Email Editor - Vue 3 Adapter Component
 *
 * Pattern: Thin Adapter around the Vanilla ArchEmailEditor Core.
 *
 * This component:
 * 1. Creates a container ref using `ref<HTMLDivElement>`.
 * 2. Instantiates `ArchEmailEditor` in `onMounted()`.
 * 3. Tears down and unbinds in `onBeforeUnmount()` to prevent memory leaks.
 * 4. Exposes component methods (`getJSON()`, `getHTML()`, `getEditor()`) via `expose()`.
 */

import { defineComponent, ref, onMounted, onBeforeUnmount, h, PropType } from 'vue';
import { ArchEmailEditor } from '../../src/editor';
import { EmailDocument } from '../../src/types';

export const VueEmailEditor = defineComponent({
  name: 'VueEmailEditor',
  props: {
    /** Initial email template schema */
    initialData: {
      type: Object as PropType<EmailDocument>,
      default: undefined
    },
    /** UI theme ('light' | 'dark') */
    theme: {
      type: String as PropType<'light' | 'dark'>,
      default: 'light'
    },
    /** Read-only state */
    readOnly: {
      type: Boolean,
      default: false
    },
    /** Sidebar position ('left' | 'right') */
    sidebarPosition: {
      type: String as PropType<'left' | 'right'>,
      default: 'right'
    }
  },
  emits: ['change', 'select'],
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let editorInstance: ArchEmailEditor | null = null;

    onMounted(() => {
      if (!containerRef.value) return;

      // Mount the vanilla editor core into the Vue template ref
      editorInstance = ArchEmailEditor.create(containerRef.value, {
        initialData: props.initialData,
        theme: props.theme,
        readOnly: props.readOnly,
        sidebarPosition: props.sidebarPosition,
        onChange: (doc) => emit('change', doc),
        onSelectBlock: (block) => emit('select', block)
      });
    });

    onBeforeUnmount(() => {
      // Destroy editor instance when Vue component unmounts
      if (editorInstance) {
        editorInstance.destroy();
        editorInstance = null;
      }
    });

    // Expose methods for template refs: const editorRef = ref(); editorRef.value.getJSON()
    expose({
      getJSON: () => editorInstance?.getJSON() ?? null,
      getHTML: () => editorInstance?.getHTML() ?? '',
      setHTML: (html: string) => editorInstance?.setHTML(html),
      loadHTML: (html: string) => editorInstance?.loadHTML(html),
      insertHTML: (html: string, options?: any) => editorInstance?.insertHTML(html, options),
      setTemplateName: (name: string) => editorInstance?.setTemplateName(name),
      getTemplateName: () => editorInstance?.getTemplateName() ?? '',
      addCustomButton: (button: any) => editorInstance?.addCustomButton(button),
      removeCustomButton: (id: string) => editorInstance?.removeCustomButton(id),
      getSidebarPosition: () => editorInstance?.getSidebarPosition() ?? null,
      setSidebarPosition: (position: 'left' | 'right') => editorInstance?.setSidebarPosition(position),
      getEditor: () => editorInstance
    });

    return () => h('div', {
      ref: containerRef,
      style: { width: '100%', height: '100%', minHeight: '600px' }
    });
  }
});
