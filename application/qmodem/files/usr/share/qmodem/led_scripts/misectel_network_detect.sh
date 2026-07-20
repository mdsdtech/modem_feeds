#!/bin/sh

. /usr/share/qmodem/led_scripts/connectivity.sh
. /usr/share/qmodem/led_scripts/misectel_led.sh

ON_OFF="$1"

misectel_led_init || exit 1
if [ "$ON_OFF" = off ]; then
	internet_leds_off
	exit 0
fi

last_connected=
while true; do
	if qmodem_connectivity_probe 3; then
		connected=1
	else
		connected=0
	fi
	if [ "$connected" != "$last_connected" ]; then
		if [ "$connected" = 1 ]; then
			led_turn "$LED_INTERNET_BLUE" 1
			led_turn "$LED_INTERNET_RED" 0
		else
			led_turn "$LED_INTERNET_BLUE" 0
			led_turn "$LED_INTERNET_RED" 1
		fi
		last_connected="$connected"
	fi
	sleep 5
done
