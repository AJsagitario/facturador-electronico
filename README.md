# Plataforma de Facturación Electrónica en Microservicios

Un sistema de facturación electrónica de nivel de producción diseñado para el sector salud. Construido bajo una arquitectura de microservicios, contenedorizado con Docker y protegido mediante túneles Zero-Trust.

## Arquitectura del Sistema

El proyecto está dividido en tres microservicios principales:

* **Frontend (Next.js):** Interfaz de usuario para la emisión de comprobantes, notas de crédito y visualización de reportes (Optimizado con modo *standalone* para producción).
* **API Core (NestJS):** Backend principal que maneja la lógica de negocio, usuarios, base de datos y la "función auto-sanadora" para corrección de comprobantes huérfanos.
* **Tax Service (PHP):** Motor tributario aislado responsable de la firma de XMLs con certificados digitales y la comunicación directa con los servidores de la SUNAT.

## Stack Tecnológico

* **Frontend:** Next.js, Tailwind CSS, TypeScript.
* **Backend:** Node.js, NestJS, TypeORM.
* **Base de Datos:** PostgreSQL 15.
* **Infraestructura & DevOps:** Docker, Docker Compose, Linux (Ubuntu VPS), Cloudflare Tunnels.
* **Integraciones:** API SUNAT (Perú).

## Seguridad y Despliegue

Este sistema está diseñado para operar detrás de Cloudflare Zero Trust, eliminando la necesidad de exponer puertos públicos en el VPS, garantizando conexiones cifradas (HTTPS) y previniendo ataques directos a la IP del servidor. Los datos sensibles (certificados `.p12`/`.pem` y credenciales de base de datos) están estrictamente gestionados vía variables de entorno.
