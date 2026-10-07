package com.itar.probe

import android.app.Dialog
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import java.lang.ref.WeakReference

internal class ProbeDialogs(private val root: ProbeRoot) {
    private val stack = ArrayList<Dialog>()
    private var closed = false
    fun show(fail: Boolean = false) {
        if (closed || stack.size == 2) return
        val opener = WeakReference(stack.lastOrNull()?.window?.decorView?.findFocus() ?: root.rootView.findFocus())
        val dialog = Dialog(root.context)
        val content = LinearLayout(root.context).apply { orientation = LinearLayout.VERTICAL }
        for (label in listOf("Nested", "Dismiss", "Dispose opener")) content.addView(Button(root.context).apply {
            text = label
            setOnClickListener {
                when (label) {
                    "Nested" -> show()
                    "Dispose opener" -> root.disappear("remove", false)
                    else -> dialog.dismiss()
                }
            }
        })
        dialog.setContentView(content)
        dialog.setOnShowListener {
            root.record("dialog shown window=${dialog.window?.decorView?.windowToken?.hashCode()} opener=${opener.get()?.let { System.identityHashCode(it) }}")
            content.viewTreeObserver.addOnGlobalFocusChangeListener { _, target ->
                root.record("dialog focus=${target?.javaClass?.simpleName ?: "absent"}")
            }
        }
        dialog.setOnDismissListener {
            stack.remove(dialog)
            val alive = opener.get()?.let { it.isAttachedToWindow && it.isEnabled && it.visibility == View.VISIBLE } ?: false
            root.record("dialog dismissed openerLive=$alive actual=${root.alias(root.rootView.findFocus())}")
            // Observe native restoration first. No speculative requestFocus on the opener.
        }
        try {
            if (fail) { root.record("dialog presentation deliberately withheld"); return }
            dialog.show()
            stack.add(dialog)
        } catch (failure: android.view.WindowManager.BadTokenException) {
            root.record("dialog presentation failed=BadToken")
        }
    }
    fun dismissTop() { stack.lastOrNull()?.dismiss() }
    fun close() {
        closed = true
        stack.toList().asReversed().forEach { it.dismiss() }
        stack.clear()
    }
}
