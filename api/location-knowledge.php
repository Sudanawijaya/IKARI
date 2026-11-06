<?php
declare(strict_types=1);

function resolve_location_knowledge(string $locationId, array $payload, string $language): array
{
    $isInstiki = $locationId === 'kampus-instiki' || str_starts_with($locationId, 'instiki-');
    if (!$isInstiki && !str_starts_with($locationId, 'bajra-sandhi-')) {
        return load_penglipuran_knowledge();
    }

    $file = $isInstiki ? 'instiki-knowledge.json' : 'bajra-sandhi-knowledge.json';
    $knowledge = json_decode((string)file_get_contents(dirname(__DIR__) . '/data/' . $file), true, 512, JSON_THROW_ON_ERROR);
    if ($isInstiki) {
        $knowledge['locations'][] = json_decode((string)file_get_contents(dirname(__DIR__) . '/src/instiki-location.json'), true, 512, JSON_THROW_ON_ERROR);
    }
    $place = $isInstiki ? 'INSTIKI' : 'Bajra Sandhi dan Denpasar';
    $location = null;
    foreach ($knowledge['locations'] as $candidate) {
        if ($candidate['id'] === $locationId) {
            $location = $candidate;
            break;
        }
    }
    if ($location === null) {
        send_json(400, ['error' => $language === 'id' ? 'Lokasi tidak dikenal' : 'Unknown location']);
    }

    $latitude = filter_var($payload['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
    $longitude = filter_var($payload['longitude'] ?? null, FILTER_VALIDATE_FLOAT);
    if ($latitude === false || $longitude === false || !is_finite($latitude) || !is_finite($longitude)
        || abs($latitude) > 90 || abs($longitude) > 180
        || location_distance_meters($latitude, $longitude, $location) > $knowledge['radiusMeters']) {
        send_json(403, ['error' => $language === 'id'
            ? "Tanya jawab {$place} hanya tersedia dalam radius 50 meter dari titik yang dipilih. Aktifkan GPS dan dekati titik tersebut."
            : "Questions about {$place} are only available within 50 metres of the selected point. Enable GPS and move closer."]);
    }
    if ($isInstiki) {
        require_once __DIR__ . '/instiki-source.php';
        $knowledge['officialWebsite'] = fetch_instiki_source($language);
    }
    return $knowledge;
}

function location_distance_meters(float $latitude, float $longitude, array $location): float
{
    $deltaLat = deg2rad($location['latitude'] - $latitude);
    $deltaLon = deg2rad($location['longitude'] - $longitude);
    $a = sin($deltaLat / 2) ** 2
        + cos(deg2rad($latitude)) * cos(deg2rad($location['latitude'])) * sin($deltaLon / 2) ** 2;
    return 6371000 * 2 * asin(sqrt(min(1.0, max(0.0, $a))));
}
