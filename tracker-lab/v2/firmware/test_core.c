#include "tracker_core.h"
#include <assert.h>
#include <stdio.h>
static at_input input(uint32_t now,bool motion,bool fix,bool ready,uint16_t mv){return (at_input){now,motion,fix,ready,false,mv};}
int main(void){
  at_tracker t;at_init(&t);at_output o=at_tick(&t,input(5000,true,true,true,3800));assert(o.request_tx&&o.gnss_power&&o.state==AT_TRACK);at_mark_sent(&t,5000);assert(t.sequence==1);
  o=at_tick(&t,input(10000,true,true,false,3800));assert(!o.request_tx&&t.sequence==1&&t.last_tx_ms==5000);
  o=at_tick(&t,input(10001,true,true,true,3800));assert(o.request_tx);at_mark_sent(&t,10001);
  at_init(&t);for(unsigned i=1;i<=11;i++){o=at_tick(&t,input(i*5000,false,true,true,3800));if(o.request_tx)at_mark_sent(&t,i*5000);}o=at_tick(&t,input(60000,false,true,true,3800));assert(o.state==AT_SLEEP&&!o.gnss_power&&!o.request_tx);
  o=at_tick(&t,input(65000,false,true,true,3800));assert(o.state==AT_SLEEP&&!o.gnss_power);
  o=at_tick(&t,input(70000,true,false,true,3800));assert(o.state==AT_ACQUIRE&&o.gnss_power&&!o.request_tx);
  o=at_tick(&t,input(75000,true,true,true,3800));assert(o.request_tx&&o.state==AT_TRACK);
  o=at_tick(&t,input(80000,true,true,true,3200));assert(o.state==AT_LOW_BAT&&!o.gnss_power&&!o.request_tx);
  o=at_tick(&t,input(85000,true,true,true,3400));assert(o.state==AT_LOW_BAT);o=at_tick(&t,input(90000,true,true,true,3600));assert(o.state==AT_TRACK);
  at_input usb=input(95000,true,true,true,3100);usb.usb_power=true;o=at_tick(&t,usb);assert(o.state==AT_TRACK);
  at_init(&t);o=at_tick(&t,input(5000,true,false,true,3800));assert(o.state==AT_ACQUIRE&&!o.request_tx);
  at_init(&t);t.last_tx_ms=UINT32_MAX-3000;t.last_motion_ms=t.last_tx_ms;o=at_tick(&t,input(2000,true,true,true,3800));assert(o.request_tx);
  puts("V2 C core: TX acknowledgement, busy radio, stationary sleep, motion wake, low-battery hysteresis, USB recovery, no-fix and timer rollover passed.");
}
