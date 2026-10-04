#ifndef AT02_TRACKER_CORE_H
#define AT02_TRACKER_CORE_H
#include <stdbool.h>
#include <stdint.h>
/* Hardware-independent C core. Not a flashable STM32 application.
 * GPIO, UART, NMEA, RTC and USB/SWD startup belong to the board port. */
typedef enum {AT_BOOT, AT_ACQUIRE, AT_TRACK, AT_SLEEP, AT_LOW_BAT} at_state;
typedef struct {
  uint32_t last_motion_ms, last_wake_ms, last_tx_ms;
  uint16_t sequence;
  at_state state;
} at_tracker;
typedef struct {
  uint32_t now_ms;
  bool motion, fix, radio_ready, usb_power;
  uint16_t battery_mv;
} at_input;
typedef struct { bool gnss_power, radio_wake, request_tx; at_state state; } at_output;
void at_init(at_tracker *tracker);
at_output at_tick(at_tracker *tracker, at_input input);
/* Only acknowledge after the UART transmitter accepts the complete packet. */
void at_mark_sent(at_tracker *tracker, uint32_t now_ms);
#endif
