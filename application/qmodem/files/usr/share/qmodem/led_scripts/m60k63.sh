#!/bin/sh

# envs
# led names
# LED_4G_POOR="red:4g"
# LED_4G_GOOD="blue:4g"
# LED_5G_POOR="red:5g"
# LED_5G_GOOD="blue:5g"
# LED_INTERNET_BLUE="blue:internet"
# LED_INTERNET_RED="red:internet"
# modem_cfg
# MODEM_CFG / AT_PORT / NET_DEV / USE_UBUS_DAEMON

. /usr/share/qmodem/modem_util.sh
. /lib/functions.sh
LED_4G_POOR="red:4g"
LED_4G_GOOD="blue:4g"
LED_5G_POOR="red:5g"
LED_5G_GOOD="blue:5g"
LED_INTERNET_BLUE="blue:internet"
LED_INTERNET_RED="red:internet"
MODEM_CFG=$1
ON_OFF=$2

update_cfg(){
	config_load qmodem
	config_get AT_PORT "$MODEM_CFG" at_port
	config_get ALIAS "$MODEM_CFG" alias
	config_get USE_UBUS "$MODEM_CFG" use_ubus
	[ "$USE_UBUS" = "1" ] && use_ubus_flag="-u"
	config_load network
	# if alias is set, network config name is alias else modem_cfg name
	if [ -n "$ALIAS" ]; then
		config_get NET_DEV "$ALIAS" ifname
	else
		config_get NET_DEV "$MODEM_CFG" ifname
	fi
}

last_siminserted=""
last_netstat=""

led_turn() {
	local path="/sys/class/leds/$1"
	local brightness="$2"

	echo "$brightness" > "$path/brightness"
}

led_heartbeat() {
	local path="/sys/class/leds/$1"

	echo "1" > "$path/brightness"
	echo "heartbeat" > "$path/trigger"
}

led_netdev() {
	local path="/sys/class/leds/$1"
	local device="$2"

	echo "1" > "$path/brightness"
	echo "netdev" > "$path/trigger"
	echo "$device" > "$path/device_name"
	echo "1" > "$path/link"
	echo "1" > "$path/rx"
	echo "1" > "$path/tx"
}

led_off_all() {
	led_turn "${LED_4G_POOR}" "0"
	led_turn "${LED_4G_GOOD}" "0"
	led_turn "${LED_5G_POOR}" "0"
	led_turn "${LED_5G_GOOD}" "0"
}

nr_bw() {
	local bw="$1"
	case "$bw" in
	"0"|"1"|"2"|"3"|"4"|"5")
		echo "$(((bw + 1) * 5))" ;;
	"6"|"7"|"8"|"9"|"10"|"11"|"12")
		echo "$(((bw - 2) * 10))" ;;
	"13")
		echo "200" ;;
	"14")
		echo "400" ;;
	"15"|"25"|"75"|"100")
		echo "$(( bw / 5 ))" ;;
	esac
}

sim_inserted() {

	if at $AT_PORT "AT+CPIN?" | grep -q "CPIN: READY"; then
		echo "1"
	else
		echo "0"
	fi
}

internet_led() {
	if wget-ssl --spider --quiet --tries=1 --timeout=3 www.baidu.com; then
		led_turn "${LED_INTERNET_BLUE}" "1"
		led_turn "${LED_INTERNET_RED}" "0"
	else
		led_turn "${LED_INTERNET_BLUE}" "0"
		led_turn "${LED_INTERNET_RED}" "1"
	fi
}

sim_netstat() {
	local mode
	local bw csq rscp rssi

	local srvinfo="$(at $AT_PORT 'AT+QENG="servingcell"')"
	if echo "$srvinfo" | grep -q "NR5G"; then
		mode="5g"
	else
		mode="4g"
	fi

	csq="$(tom_modem -d /dev/mhi_DUN -c "AT+CSQ" | grep -Eo '\+CSQ: [0-9]{2}' | awk '{print $2}')"
	rssi="$(( 2 * csq - 113 ))"
	if [ "$csq" = "99" ]; then
		bw="$(nr_bw "$(echo "$srvinfo" | awk -F ',' '/^\+QENG/ {print $12}')")"
		rscp="$(echo "$srvinfo" | awk -F ',' '/^\+QENG/ {print $13}')"
		rssi="$(rsrp2rssi "$rscp" "$bw")"
	fi

	# 0: no service, 1: weak, 2: good
	if [ "$rssi" = "-113" ] || [ "$rssi" = "85" ]; then
		echo "$mode,0"
	elif [ "$rssi" -le "-70" ]; then
		echo "$mode,1"
	else
		echo "$mode,2"
	fi
}

main() {
	local siminserted="$(sim_inserted "/dev/mhi_DUN")"
	if [ "$siminserted" = "0" ] && [ "$siminserted" = "$last_siminserted" ]; then
		# there's no update, return
		return
	fi

	last_siminserted="$siminserted"

	if [ "$siminserted" = "0" ]; then
		led_off_all
		led_heartbeat ${LED_4G_POOR}
		led_heartbeat ${LED_5G_POOR}

		last_netstat=""
		return
	fi

	local netstat="$(sim_netstat)"

	if [ "$netstat" = "$last_netstat" ]; then
		# there's no update, return
		return
	fi
	local mode="${netstat%,*}"
	local signal="${netstat#*,}"

	case "$signal" in
	"0")
		led_off_all
		case "$mode" in
			"4g")
				led_heartbeat "${LED_4G_POOR}"
				;;
			"5g")
				led_heartbeat "${LED_5G_POOR}"
				;;
		esac
		;;
	"1")
		led_off_all
		case "$mode" in
			"4g")
				led_turn "${LED_4G_POOR}" "1"
				led_netdev "${LED_4G_GOOD}" "$NET_DEV"
				;;
			"5g")
				led_turn "${LED_5G_POOR}" "1"
				led_netdev "${LED_5G_GOOD}" "$NET_DEV"
				;;
		esac
		;;
	"2")
		led_off_all
		case "$mode" in
			"4g")
				led_turn "${LED_4G_GOOD}" "1"
				led_netdev "${LED_4G_GOOD}" "$NET_DEV"
				;;
			"5g")
				led_turn "${LED_5G_GOOD}" "1"
				led_netdev "${LED_5G_GOOD}" "$NET_DEV"
				;;
		esac
		;;
	esac
}

# Loop forever
update_cfg
if [ "$ON_OFF" = "off" ]; then
	led_off_all
	exit 0
fi
while true; do
	main
	internet_led
	sleep 5s
done
