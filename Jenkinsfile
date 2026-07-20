pipeline {
    agent any

    environment {
        APP_NAME = 'jenkins-microservices-app'
        DOCKER_COMPOSE_FILE = 'docker/docker-compose.test.yml'
        GIT_COMMIT_SHORT = "${env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'local'}"
    }

    stages {
        stage('Verificar Código') {
            steps {
                echo 'Validando estructura del proyecto...'
                script {
                    def services = ['api-gateway', 'user-service', 'product-service']
                    services.each { service ->
                        if (!fileExists("services/${service}/package.json")) {
                            error "package.json no encontrado en ${service}"
                        }
                    }
                }
                echo 'Estructura válida.'
            }
        }

        stage('Pruebas de Contrato') {
            steps {
                echo 'Verificando contratos entre servicios...'
                sh 'node scripts/validate-contract.js services/user-service shared/contracts/user-contract.json'
                sh 'node scripts/validate-contract.js services/api-gateway shared/contracts/user-contract.json'
            }
        }
    }
}