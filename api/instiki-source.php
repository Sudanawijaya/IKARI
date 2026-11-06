<?php
declare(strict_types=1);

/** Fetch only the fixed official origin; user input never controls the URL. */
function fetch_instiki_source(string $language): array
{
    $url = 'https://instiki.ac.id/';
    $html = '';
    $handle = curl_init($url);
    if ($handle === false) {
        throw new RuntimeException('Tidak bisa mengakses sumber resmi INSTIKI');
    }
    curl_setopt_array($handle, [
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_USERAGENT => 'IKARI/1.0 (official campus knowledge)',
        CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$html): int {
            if (strlen($html) + strlen($chunk) > 2097152) {
                return 0;
            }
            $html .= $chunk;
            return strlen($chunk);
        },
    ]);
    $ok = curl_exec($handle);
    $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    curl_close($handle);
    $text = preg_replace('~<(script|style|noscript|svg)\b[^>]*>.*?</\1>~is', '', $html) ?? '';
    $text = preg_replace('~</(?:p|div|h[1-6]|li|section|article)>|<br\s*/?>~i', "\n", $text) ?? '';
    $text = trim(html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    $text = preg_replace('/[\t ]+/', ' ', $text) ?? '';
    $text = preg_replace('/\n\s*\n+/', "\n", $text) ?? '';
    if ($ok === false || $status !== 200 || strlen($text) < 200 || stripos($text, 'INSTIKI') === false) {
        send_json(503, ['error' => $language === 'id'
            ? 'Sumber resmi instiki.ac.id belum dapat diakses. Silakan coba lagi; jawaban INSTIKI hanya memakai sumber resmi tersebut.'
            : 'The official instiki.ac.id source is unavailable. Please try again; INSTIKI answers use only that official source.']);
    }
    // Keep UTF-8 intact and bound the context size.
    preg_match('/^.{0,16000}/us', $text, $matches);
    return ['url' => $url, 'retrievedAt' => gmdate('c'), 'text' => $matches[0] ?? ''];
}
