FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod *.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /events .

FROM alpine:3.23
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 dorm
WORKDIR /app
COPY --from=build /events /app/events
COPY web /app/web
RUN mkdir /app/data && chown -R dorm:dorm /app
USER dorm
ENV ADDR=0.0.0.0:8080 DATA_FILE=/app/data/dormitory.json
EXPOSE 8080
CMD ["/app/events"]
