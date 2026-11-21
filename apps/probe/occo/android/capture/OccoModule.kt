package com.itar.adapter

import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.atomic.AtomicBoolean

class OccoModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context), LifecycleEventListener {
    private val worker = Executors.newSingleThreadExecutor()
    private val reading = AtomicBoolean(false)
    override fun getName() = "Occo"
    override fun initialize() { super.initialize(); context.addLifecycleEventListener(this) }
    override fun onHostResume() { OccoCapture.attach(context.currentActivity?.window) }
    override fun onHostPause() { OccoCapture.detach() }
    override fun onHostDestroy() { OccoCapture.detach() }
    override fun invalidate() {
        context.removeLifecycleEventListener(this)
        worker.shutdown()
        super.invalidate()
    }

    private fun control(promise: Promise, action: () -> Unit) = context.runOnUiQueueThread {
        try { action(); promise.resolve(OccoCapture.state) }
        catch (failure: Exception) { promise.reject("OCCO_CONTROL", failure) }
    }

    @ReactMethod fun start(promise: Promise) = control(promise) { OccoCapture.start(context.currentActivity?.window) }
    @ReactMethod fun mark(promise: Promise) = control(promise) { OccoCapture.mark() }
    @ReactMethod fun freeze(promise: Promise) = control(promise) { OccoCapture.freeze() }
    @ReactMethod fun state(promise: Promise) = control(promise) {}

    private fun read(promise: Promise, operation: () -> String) {
        if (!reading.compareAndSet(false, true)) { promise.reject("OCCO_BUSY", "A recording read is already in progress"); return }
        try {
            worker.execute {
                val value = try { operation() } catch (failure: Exception) {
                    reading.set(false)
                    promise.reject("OCCO_READ", failure)
                    return@execute
                }
                reading.set(false)
                promise.resolve(value)
            }
        } catch (closed: RejectedExecutionException) {
            reading.set(false)
            promise.reject("OCCO_READ", closed)
        }
    }

    @ReactMethod fun snapshot(promise: Promise) = read(promise) { OccoCapture.snapshotJson() }
    @ReactMethod fun exportRecording(promise: Promise) = read(promise) { OccoCapture.exportFile(context).absolutePath }
}
