<?php
/**
 * Serves index.html with no-store headers so refreshes always hit the host.
 */
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Content-Type: text/html; charset=utf-8');

$path = __DIR__ . '/index.html';
if (!is_file($path)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "index.html missing\n";
    exit;
}

readfile($path);
