<?php
namespace App;

use Greenter\Model\Client\Client;
use Greenter\Model\Company\Company;
use Greenter\Model\Company\Address;
use Greenter\Model\Sale\Invoice;
use Greenter\Model\Sale\Note;
use Greenter\Model\Sale\SaleDetail;
use Greenter\Model\Sale\Legend;
use Greenter\See;
use Greenter\Ws\Services\SunatEndpoints;
use Greenter\Report\HtmlReport;
use Greenter\Report\Resolver\DefaultTemplateResolver;

class InvoiceGenerator
{
    private $see;

    // 🔥 MODIFICADO: Ahora recibe las credenciales dinámicamente
    public function __construct(string $certificatePath, string $ruc, string $usuarioSol, string $claveSol, string $certPassword = '')
    {
        $this->see = new See();
        
        // 1. LECTURA INTELIGENTE DEL CERTIFICADO
        $ext = pathinfo($certificatePath, PATHINFO_EXTENSION);
        if ($ext === 'p12') {
            // Desencriptamos el .p12 en memoria usando la contraseña
            $p12 = file_get_contents($certificatePath);
            $certs = [];
            if (openssl_pkcs12_read($p12, $certs, $certPassword)) {
                $this->see->setCertificate($certs['cert'] . $certs['pkey']);
            } else {
                throw new \Exception('🛑 CRÍTICO: No se pudo leer el certificado .p12. Verifica la contraseña.');
            }
        } else {
            // Lectura normal para tu certificate.pem de prueba
            $this->see->setCertificate(file_get_contents($certificatePath));
        }

        // 2. SELECCIÓN DE ENTORNO (BETA VS PRODUCCIÓN)
        if ($usuarioSol === 'MODDATOS') {
            $this->see->setService(SunatEndpoints::FE_BETA);
        } else {
            $this->see->setService(SunatEndpoints::FE_PRODUCCION); // 🚀 LA MAGIA SUCEDE AQUÍ
        }
        
        // 3. INYECCIÓN DE CLAVE SOL
        $this->see->setClaveSOL($ruc, $usuarioSol, $claveSol);
    }

    public function createInvoice(array $data): array
    {
        // 1. Emisor
        $company = new Company();
        $company->setRuc($data['emisor']['ruc'])
            ->setRazonSocial($data['emisor']['razon_social'])
            ->setAddress((new Address())
                ->setUbigueo($data['emisor']['ubigueo'])
                ->setDireccion($data['emisor']['direccion']));

        // 2. Cliente
        $client = new Client();
        $client->setTipoDoc($data['cliente']['tipo_doc'])
            ->setNumDoc($data['cliente']['num_doc'])
            ->setRznSocial($data['cliente']['razon_social']);
        if (!empty($data['cliente']['direccion'])) {
            $client->setAddress((new Address())->setDireccion($data['cliente']['direccion']));
        }

        // 3. Documento (Factura o Boleta)
        if ($data['tipo_doc'] === '07') {
            $invoice = new Note();
            $invoice->setCodMotivo($data['codMotivo'] ?? '01')
                    ->setDesMotivo($data['desMotivo'] ?? 'ANULACION POR ERROR')
                    ->setTipDocAfectado($data['tipoDocAfectado'])
                    ->setNumDocfectado($data['numDocAfectado']);
        } else {
            $invoice = new Invoice();
            $invoice->setTipoOperacion('0101')
                    ->setValorVenta($data['total_gravado'])
                    ->setSubTotal($data['total_venta']);
        }

        $invoice->setUblVersion('2.1')
            ->setTipoDoc($data['tipo_doc'])
            ->setSerie($data['serie'])
            ->setCorrelativo($data['correlativo'])
            ->setFechaEmision(new \DateTime($data['fecha_emision'] . ' ' . $data['hora_emision']))
            ->setTipoMoneda($data['moneda'])
            ->setCompany($company)
            ->setClient($client)
            ->setMtoOperGravadas($data['total_gravado'])
            ->setMtoIGV($data['total_igv'])
            ->setTotalImpuestos($data['total_igv'])
            ->setMtoImpVenta($data['total_venta']);

        // 4. Ítems
        $items = [];
        foreach ($data['items'] as $it) {
            $item = (new SaleDetail())
                ->setCodProducto($it['codigo'])
                ->setUnidad('ZZ')
                ->setCantidad($it['cantidad'])
                ->setDescripcion($it['descripcion'])
                ->setMtoBaseIgv($it['valor_unitario'] * $it['cantidad'])
                ->setPorcentajeIgv(18.00)
                ->setIgv($it['igv'])
                ->setTipAfeIgv($it['tipo_afectacion'])
                ->setTotalImpuestos($it['igv'])
                ->setMtoValorVenta($it['valor_unitario'] * $it['cantidad'])
                ->setMtoValorUnitario($it['valor_unitario'])
                ->setMtoPrecioUnitario($it['precio_unitario']);
            $items[] = $item;
        }
        $invoice->setDetails($items);

        // 5. Leyendas
        $legend = (new Legend())
            ->setCode('1000')
            ->setValue($data['leyenda_monto_letras']);
        $invoice->setLegends([$legend]);

        // 6. ENVIAR A SUNAT
        $res = $this->see->send($invoice);

        if (!$res->isSuccess()) {
            throw new \Exception("Error SUNAT: " . $res->getError()->getCode() . " - " . $res->getError()->getMessage());
        }

        // 🎨 LOGO Y COLOR CORPORATIVO DINÁMICO
        // ==========================================
        $rucEmisor = $data['emisor']['ruc'];
        
        $logoName = 'azul.png'; 
        $colorPrincipal = '#0891b2'; // Tu celeste original que le daba vida

        if ($rucEmisor === '20609478056') { // ANTARES
            $logoName = 'celeste.png';
            $colorPrincipal = '#00bcd4'; 
        } elseif ($rucEmisor === '20601969051') { // VISION MONTECRISTO
            $logoName = 'gris.png';
            $colorPrincipal = '#64748b'; 
        } elseif ($rucEmisor === '20609526964') { // PROXIMA CENTAURI
            $logoName = 'azul.png';
            $colorPrincipal = '#2563eb'; 
        } elseif ($rucEmisor === '20609414660') { // CENTRO DE EXCELENCIA
            $logoName = 'original.png'; 
            $colorPrincipal = '#0f172a'; // Azul oscuro para que contraste tu logo blanco
        }

        $logoPath = __DIR__ . '/../resources/' . $logoName;
        $logoBytes = '';
        
        // 💡 EL SECRETO: Greenter necesita los BYTES PUROS, no base64_encode
        if (file_exists($logoPath)) {
            $logoBytes = file_get_contents($logoPath); 
        }

        // 7. Generar PDF
        $report = new HtmlReport();
        $resolver = new DefaultTemplateResolver();
        $report->setTemplate($resolver->getTemplate($invoice));
        
        $parametros = [
            'system' => [
                'logo' => $logoBytes, // <- Pasamos la imagen correctamente
                'hash' => $res->getCdrResponse() ? $res->getCdrResponse()->getReference() : ''
            ]
        ];
        $pdfContent = $report->render($invoice, $parametros);

        // ==========================================
        // 🎨 INYECCIÓN DE TU DISEÑO ORIGINAL
        // ==========================================
        
        // 1. Tipografía y bordes suaves (Tu código exacto)
        $pdfContent = str_replace('font-family: Verdana, monospace', "font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", $pdfContent);
        $pdfContent = str_replace('#666', '#cbd5e1', $pdfContent); 
        $pdfContent = str_replace('border-bottom:1px solid #000', 'border-bottom:1px solid #cbd5e1', $pdfContent);
        $pdfContent = str_replace('td{padding:6}', 'td{padding:12px 14px}', $pdfContent);

        // 2. Tu CSS corporativo original, inyectando la variable de color
        $cssCorporativo = "
        .tabla_borde { border: 1.5px solid {$colorPrincipal} !important; border-radius: 12px !important; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        td.bold { color: {$colorPrincipal} !important; background-color: #f8fafc !important; border-bottom: 2px solid {$colorPrincipal} !important; font-size: 13px; }
        .table-valores-totales strong { color: {$colorPrincipal} !important; font-size: 14px; }
        .ride-importeTotal { color: {$colorPrincipal} !important; font-weight: bold; font-size: 18px; }
        /* Evita que el logo rompa la tabla */
        .logo img { max-height: 80px; max-width: 260px; object-fit: contain; }
        ";

        // 3. Ajuste especial para Centro de Excelencia
        if ($rucEmisor === '20609414660') {
            $cssCorporativo .= "
            table.head { background-color: #0f172a !important; color: white !important; border-radius: 16px; padding: 10px; }
            table.head strong, table.head span, table.head td { color: white !important; }
            ";
        }

        $pdfContent = str_replace('</style>', $cssCorporativo . '</style>', $pdfContent);

        return [
            'filename' => $invoice->getName(),
            'hash' => $res->getCdrResponse() ? $res->getCdrResponse()->getReference() : 'N/A',
            'xml_content' => $this->see->getFactory()->getLastXml(),
            'pdf_content' => $pdfContent
        ];
    }
}