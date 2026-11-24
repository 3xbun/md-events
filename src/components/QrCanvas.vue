<template>
  <canvas ref="canvas"></canvas>
</template>

<script setup>
import * as QRCode from "qrcode";
import { ref, onMounted, watch } from "vue";

const props = defineProps({
  text: { type: String, required: true },
  size: { type: [Number, String], default: 200 },
});

const canvas = ref(null);

const draw = async () => {
  if (!canvas.value || !props.text) return;
  try {
    await QRCode.toCanvas(canvas.value, props.text, {
      width: Number(props.size) || 200,
      margin: 1,
      color: { dark: "#06121f", light: "#ffffff" },
    });
  } catch (e) {
    console.error("QR draw failed", e);
  }
};

onMounted(draw);
watch(() => props.text, draw);
</script>

<style scoped>
canvas {
  background: #fff;
  border-radius: 10px;
  padding: 0.45rem;
}
</style>
