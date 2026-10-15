package com.itar.adapter

import android.app.Dialog
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import java.lang.ref.WeakReference

internal data class Restoration(val lifetime: Long, val key: String?)

/** Explicit owned-dialog coordinator; separate windows own separate core lifetimes. */
internal class Dialogs(private val root: SurfaceView) {
    private data class Entry(val dialog: Dialog, val content: SurfaceView,
        val opener: WeakReference<SurfaceView>, val restoration: Restoration)
    private val stack = ArrayList<Entry>()
    private var closed = false
    val depth get() = stack.size
    val currentSurface get() = stack.lastOrNull()?.content ?: root
    fun show(withhold: Boolean = false): Boolean {
        if (closed || root.closed || stack.size == 2) return false
        val opener = currentSurface
        if (!opener.hasWindowFocus() || opener.dispatcher.busy) return false
        val token = Restoration(opener.connection.lifetime, (opener.findFocus() as? TargetView)?.mount?.key)
        val dialog = Dialog(root.context)
        val content = object : SurfaceView(root.context) {
            override fun onMeasure(width: Int, height: Int) {
                setMeasuredDimension(View.resolveSize(600, width), View.resolveSize(320, height))
            }
            override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
                super.onLayout(changed, l, t, r, b)
                for (i in 0 until childCount) getChildAt(i).layout(24, 24 + i * 88, width - 24, 96 + i * 88)
            }
        }
        for (label in listOf("Nested", "Dismiss", "Dispose opener")) content.addView(TargetView(root.context).apply {
            occurrenceKey = "dialog/$label"; text = label; contentDescription = label
            setOnClickListener {
                when (label) { "Nested" -> show(); "Dismiss" -> dialog.dismiss(); else -> opener.close() }
            }
        })
        val entry = Entry(dialog, content, WeakReference(opener), token)
        dialog.setContentView(content, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        dialog.setOnDismissListener {
            val index = stack.indexOf(entry)
            if (index >= 0) {
                stack.drop(index + 1).asReversed().forEach { it.dialog.dismiss() }
                stack.remove(entry)
            }
            content.close()
            if (!closed) entry.opener.get()?.resume(entry.restoration)
        }
        var prepared = false
        opener.dispatcher.batch {
            opener.observe()
            opener.dispatcher.submit(16)
            prepared = opener.connection.exchange(17)[0] == 0L
            if (prepared) opener.cover(true) else opener.close()
        }
        if (!prepared) { content.close(); return false }
        try {
            if (withhold) { content.close(); opener.resume(token); return false }
            stack.add(entry)
            dialog.show()
            dialog.window?.setLayout(600, 320)
            if (root.closed) { dialog.dismiss(); return false }
            return true
        } catch (failure: RuntimeException) {
            stack.remove(entry)
            content.close()
            opener.resume(token)
            if (failure !is WindowManager.BadTokenException && failure !is WindowManager.InvalidDisplayException) throw failure
            return false
        }
    }
    fun dismiss() { stack.lastOrNull()?.dialog?.dismiss() }
    fun close() {
        if (closed) return
        closed = true
        stack.toList().asReversed().forEach { it.dialog.dismiss() }
        stack.clear()
    }
}
