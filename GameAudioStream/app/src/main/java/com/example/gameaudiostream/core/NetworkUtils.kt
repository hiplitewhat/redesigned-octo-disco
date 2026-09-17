package com.example.gameaudiostream.core

import java.net.Inet4Address
import java.net.NetworkInterface

/** Helpers for discovering the device's LAN address so the sender knows where to connect. */
object NetworkUtils {

    /**
     * Best-effort local IPv4 address (e.g. "192.168.1.23") that this device is
     * reachable on. Prefers wlan* interfaces and RFC1918 ranges so that VPN or
     * mobile-data interfaces do not win.
     *
     * Returns null when no usable address was found (e.g. Wi-Fi is off).
     */
    fun localIpv4Address(): String? {
        data class Candidate(val address: String, val priority: Int)

        val candidates = mutableListOf<Candidate>()
        val interfaces = NetworkInterface.getNetworkInterfaces() ?: return null
        while (interfaces.hasMoreElements()) {
            val nif = interfaces.nextElement()
            try {
                if (!nif.isUp || nif.isLoopback || nif.isVirtual) continue
                val addresses = nif.inetAddresses
                while (addresses.hasMoreElements()) {
                    val addr = addresses.nextElement()
                    if (addr is Inet4Address && !addr.isLoopbackAddress) {
                        val host = addr.hostAddress ?: continue
                        candidates += Candidate(host, priorityOf(nif.name, host))
                    }
                }
            } catch (_: Exception) {
                // Ignore interfaces we are not allowed to inspect.
            }
        }
        return candidates.minByOrNull { it.priority }?.address
    }

    /** Lower number wins. Wi-Fi interfaces on private ranges are the common case. */
    private fun priorityOf(interfaceName: String, address: String): Int {
        var priority = 100
        if (interfaceName.startsWith("wlan")) priority -= 50
        if (address.startsWith("192.168.") ||
            address.startsWith("10.") ||
            address.startsWith("172.")
        ) {
            priority -= 20
        }
        return priority
    }
}
