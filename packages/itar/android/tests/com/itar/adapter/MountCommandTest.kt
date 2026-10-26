package com.itar.adapter

import junit.framework.TestCase

class MountCommandTest : TestCase() {
    fun testCommandsObserveCommittedPropsAndPreserveOwnership() = MountCommandChecks.run()
}
