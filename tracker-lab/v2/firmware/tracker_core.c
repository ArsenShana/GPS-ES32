#include "tracker_core.h"
void at_init(at_tracker *t) { *t=(at_tracker){0,0,0,0,AT_BOOT}; }
at_output at_tick(at_tracker *t, at_input in) {
  at_output out={true,false,false,t->state};
  if(in.motion)t->last_motion_ms=in.now_ms;
  if(!in.usb_power && in.battery_mv<3300) { t->state=AT_LOW_BAT;out.gnss_power=false; }
  else if(t->state==AT_LOW_BAT && !in.usb_power && in.battery_mv<3500) {out.gnss_power=false;}
  else if(t->state==AT_SLEEP && in.motion) {t->state=AT_ACQUIRE;t->last_wake_ms=in.now_ms;}
  else if(t->state==AT_SLEEP && (uint32_t)(in.now_ms-t->last_wake_ms)<300000) {out.gnss_power=false;}
  else if(!in.motion && in.fix && (uint32_t)(in.now_ms-t->last_motion_ms)>=60000 && t->state!=AT_SLEEP) {
    t->state=AT_SLEEP;t->last_wake_ms=in.now_ms;out.gnss_power=false;
  } else {
    if(t->state==AT_SLEEP){t->last_motion_ms=in.now_ms;t->last_wake_ms=in.now_ms;}
    t->state=in.fix?AT_TRACK:AT_ACQUIRE;
    if(in.fix && (uint32_t)(in.now_ms-t->last_tx_ms)>=5000){out.radio_wake=true;out.request_tx=in.radio_ready;}
  }
  out.state=t->state;return out;
}
void at_mark_sent(at_tracker *t,uint32_t now_ms){t->last_tx_ms=now_ms;t->sequence++;}
