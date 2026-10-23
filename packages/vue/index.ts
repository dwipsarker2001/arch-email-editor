import { defineComponent, ref, onMounted, onBeforeUnmount, h, PropType } from 'vue';
import { ArchEmailEditor } from '../../src/editor';
import { EmailDocument } from '../../src/types';

export const VueEmailEditor = defineComponent({
  name: 'VueEmailEditor',
  props: {
    initialData: {
      type: Object as PropType<EmailDocument>,
      default: undefined
    },
    theme: {
      type: String as PropType<'light' | 'dark'>,
      default: 'light'
    },
    readOnly: {
      type: Boolean,
      default: false
    }
  },
  emits: ['change', 'select'],
  setup(props, { emit, expose }) {
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

    expose({
      getJSON: () => editorInstance?.getJSON() ?? null,
      getHTML: () => editorInstance?.getHTML() ?? '',
      getEditor: () => editorInstance
    });

    return () => h('div', {
      ref: containerRef,
      style: { width: '100%', height: '100%', minHeight: '600px' }
    });
  }
});
