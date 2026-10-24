package app.dshremote

import app.dshremote.data.Prefs
import app.dshremote.util.FileNames
import app.dshremote.util.Urls
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UrlsTest {
    @Test
    fun normalizesHostPortAndDefaultsToTheGatePort() {
        assertEquals("http://192.168.1.23:3080/", Urls.normalize("192.168.1.23:3080"))
        assertEquals("http://192.168.1.23:3080/", Urls.normalize("http://192.168.1.23:3080/"))
        assertEquals("http://192.168.1.23:3080/", Urls.normalize("  192.168.1.23  "))
        assertEquals("https://example.com:443/", Urls.normalize("https://example.com"))
    }

    @Test
    fun rejectsUnsupportedOrEmptyAddresses() {
        assertNull(Urls.normalize(""))
        assertNull(Urls.normalize("ftp://example.com"))
        assertNull(Urls.normalize("http://"))
    }

    @Test
    fun privateRangesMatchTheGateFence() {
        assertTrue(Urls.isPrivateHost("10.1.2.3"))
        assertTrue(Urls.isPrivateHost("172.16.0.1"))
        assertTrue(Urls.isPrivateHost("172.31.255.254"))
        assertTrue(Urls.isPrivateHost("192.168.1.23"))
        assertTrue(Urls.isPrivateHost("100.64.0.1"))
        assertTrue(Urls.isPrivateHost("127.0.0.1"))
        assertTrue(Urls.isPrivateHost("169.254.1.1"))
        assertTrue(Urls.isPrivateHost("nas.local"))
        assertTrue(Urls.isPrivateHost("localhost"))
        assertFalse(Urls.isPrivateHost("172.32.0.1"))
        assertFalse(Urls.isPrivateHost("8.8.8.8"))
        assertFalse(Urls.isPrivateHost("example.com"))
    }
}

class DownloadPathTest {
    @Test
    fun keepsANormalRelativeFolder() {
        assertEquals("DeepSeek Harness", Prefs.normalizeDownloadSubdir("DeepSeek Harness"))
        assertEquals("a/b", Prefs.normalizeDownloadSubdir("a/b"))
        assertEquals("a/b", Prefs.normalizeDownloadSubdir("a\\b"))
    }

    @Test
    fun rejectsEscapesAndEmptySegments() {
        assertNull(Prefs.normalizeDownloadSubdir(""))
        assertNull(Prefs.normalizeDownloadSubdir("   "))
        assertNull(Prefs.normalizeDownloadSubdir(".."))
        assertNull(Prefs.normalizeDownloadSubdir("a/../b"))
        assertNull(Prefs.normalizeDownloadSubdir("a//b"))
        assertNull(Prefs.normalizeDownloadSubdir("/abs"))
    }
}

class FileNamesTest {
    @Test
    fun prefersTheRfc5987Filename() {
        val disposition = "attachment; filename=\"fallback.pdf\"; filename*=UTF-8''%E6%8A%A5%E5%91%8A.pdf"
        assertEquals("报告.pdf", FileNames.from(disposition, "http://h/api/remote/download?path=x"))
    }

    @Test
    fun fallsBackToThePlainFilename() {
        assertEquals("a b.txt", FileNames.from("attachment; filename=\"a b.txt\"", "http://h/x"))
    }

    @Test
    fun fallsBackToThePathQueryParameter() {
        val url = "http://h/api/remote/download?path=C%3A%5Ctmp%5Cx.zip"
        assertEquals("x.zip", FileNames.from(null, url))
    }

    @Test
    fun stripsPathSeparators() {
        val name = FileNames.from(null, "http://h/api/remote/download?path=%2Ftmp%2F..%2Fetc%2Fpasswd")
        assertFalse(name.contains("/"))
        assertFalse(name.contains("\\"))
    }
}
