// SETU — Order state machine. Server owns the transition; UI only uses this for presentation/guards.
export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending', CONFIRMED: 'confirmed', PREPARING: 'preparing', READY: 'ready',
  PICKED_UP: 'picked_up', ON_THE_WAY: 'on_the_way', DELIVERED: 'delivered', CANCELLED: 'cancelled',
});
export const ORDER_TRANSITIONS = Object.freeze({
  pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready'],
  ready: ['picked_up'], picked_up: ['on_the_way'], on_the_way: ['delivered'], delivered: [], cancelled: [],
});
export const canTransition = (from, to) => ORDER_TRANSITIONS[from]?.includes(to) ?? false;
