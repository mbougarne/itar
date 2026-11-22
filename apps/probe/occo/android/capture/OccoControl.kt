package com.itar.adapter

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Debug manifest restricts external incident markers to the shell/system DUMP permission. */
class OccoControl : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            "com.itarprobe.occo.MARK" -> OccoCapture.mark()
            "com.itarprobe.occo.FREEZE" -> OccoCapture.freeze()
        }
    }
}
