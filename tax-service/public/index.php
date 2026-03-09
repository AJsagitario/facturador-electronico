<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
require __DIR__ . '/../vendor/autoload.php';
use App\InvoiceGenerator;

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];


if ($path === '/generate-xml' || $path === '/index.php/generate-xml') {
    if ($method === 'POST') {
        try {
            $json = file_get_contents('php://input');
            $data = json_decode($json, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception("JSON inválido");
            }

            $rucEmisor = $data['emisor']['ruc'];

            // 🛡️ ENRUTADOR DE CREDENCIALES
            if ($rucEmisor === '20609526964') { 
                // GESTION MEDICA PROXIMA CENTAURI S.R.L.
                $certPath = __DIR__ . '/../resources/certificado.pem';
                $usuarioSol = 'GESTIO26';
                $claveSol = 'Gestion26$'; 
                $certPass = ''; 

            } elseif ($rucEmisor === '20609478056') {
                // ANTARES HEALTH MANAGEMENT S.R.L.
                $certPath = __DIR__ . '/../resources/certificado_antares.pem'; // <-- Apuntamos al nuevo archivo
                $usuarioSol = 'ANTAR156';
                $claveSol = 'Antar15$';     
                $certPass = '';
            
            } elseif ($rucEmisor === '20609414660') {
                // CENTRO DE EXCELENCIA EN GLAUCOMA S.R.L.
                $certPath = __DIR__ . '/../resources/certificado_excelencia.pem'; 
                $usuarioSol = 'CENTRO12';
                $claveSol = 'Centro12$';
                $certPass = '';
               
            } elseif ($rucEmisor === '20601969051') {
                // VISION MONTECRISTO S.R.L.
                $certPath = __DIR__ . '/../resources/certificado_montecristo.pem'; 
                $usuarioSol = 'VISIONM1'; 
                $claveSol = 'Vi12345';     
                $certPass = '';    
            } else {
                // BETA
                $certPath = __DIR__ . '/../resources/certificate.pem';
                $usuarioSol = 'MODDATOS';
                $claveSol = 'MODDATOS';
                $certPass = '';
            }

            // Instanciamos con las credenciales dinámicas
            $generator = new InvoiceGenerator($certPath, $rucEmisor, $usuarioSol, $claveSol, $certPass);
            $result = $generator->createInvoice($data);

            echo json_encode([
                'success' => true,
                'message' => 'Comprobante generado',
                'data' => [
                    'filename' => $result['filename'],
                    'hash' => $result['hash'],
                    'xml_base64' => base64_encode($result['xml_content']),
                    'pdf_base64' => base64_encode($result['pdf_content'] ?? '') 
                ]
            ]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
    } else {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
    }
} else {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Endpoint no encontrado']);
}