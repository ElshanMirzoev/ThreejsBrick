<?php
// api/log.php - Серверный модуль аналитики просмотров для завода ЧЗСК
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$logFile = __DIR__ . '/views.log';

// 1. Клиент выбрал цвет / конфигурацию кирпича (POST)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    // Сброс статистики администратором
    if ($data && isset($data['action']) && $data['action'] === 'reset') {
        if (file_exists($logFile)) {
            @unlink($logFile);
        }
        echo json_encode(['status' => 'cleared']);
        exit;
    }

    if ($data && !empty($data['color_brick'])) {
        $entry = [
            'timestamp'     => date('c'),
            'color_brick'   => htmlspecialchars(trim($data['color_brick'])),
            'size'          => htmlspecialchars(trim($data['size'] ?? '250x120x88')),
            'layout'        => htmlspecialchars(trim($data['layout'] ?? 'classic')),
            'color_rastvor' => htmlspecialchars(trim($data['color_rastvor'] ?? 'white')),
            'trigger'       => htmlspecialchars(trim($data['trigger'] ?? 'Конфигуратор'))
        ];

        // Безопасная дозапись с эксклюзивной блокировкой файла (LOCK_EX)
        file_put_contents($logFile, json_encode($entry, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
        echo json_encode(['status' => 'ok']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'invalid_data']);
    exit;
}

// 2. Страница аналитики запросила журнал (GET)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!file_exists($logFile)) {
        echo json_encode([]);
        exit;
    }

    $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $result = [];
    if (is_array($lines)) {
        foreach ($lines as $line) {
            $item = json_decode($line, true);
            if ($item) {
                $result[] = $item;
            }
        }
    }

    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

// 3. Сброс журнала через DELETE
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    if (file_exists($logFile)) {
        @unlink($logFile);
    }
    echo json_encode(['status' => 'cleared']);
    exit;
}
