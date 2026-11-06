import { createRouter, createWebHistory } from "vue-router";

import Home from "../views/Home.vue";
import EventDetail from "../views/EventDetail.vue";
import Checkout from "../views/Checkout.vue";
import Confirmation from "../views/Confirmation.vue";
import Admin from "../views/Admin.vue";

const routes = [
  { path: "/", name: "home", component: Home },
  { path: "/event/:id", name: "event", component: EventDetail },
  { path: "/checkout/:id", name: "checkout", component: Checkout },
  { path: "/confirmation/:code", name: "confirmation", component: Confirmation },
  { path: "/admin", name: "admin", component: Admin },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
